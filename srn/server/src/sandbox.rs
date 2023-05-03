use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use lazy_static::lazy_static;
use rand::SeedableRng;
use rand_pcg::rand_core::RngCore;
use rand_pcg::Pcg64Mcg;
use uuid::Uuid;

use crate::indexing::{find_my_ship, find_my_ship_mut, ObjectSpecifier};
use crate::inventory::{add_item, InventoryItem, InventoryItemType};
use crate::market::get_default_value;
use crate::random_stuff::{
    gen_color, gen_planet_name, gen_star_color, gen_star_name, random_hex_seed, PLANET_NAMES,
};
use crate::system_gen::{
    gen_planet, gen_planet_typed, gen_star, str_to_hash, PlanetType, PoolRandomPicker,
};
use crate::vec2::Vec2f64;
use crate::world::{
    Asteroid, AsteroidBelt, GameState, Location, Movement, PlanetV2, RotationMovement, Ship,
    SpatialProps, Star,
};
use crate::{indexing, prng_id};
use crate::{new_id, world};
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum SandboxTeleportTarget {
    Unknown,
    Zero,
}

lazy_static! {
    pub static ref SAVED_STATES: Arc<Mutex<Box<StateDictionary>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum ReferencableId {
    Id { id: Uuid },
    Reference { reference: String },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SBAddPlanet {
    p_type: PlanetType,
    full_period_ticks: f64,
    radius: f64,
    position: Vec2f64,
    anchor_id: ReferencableId,
    anchor_tier: u32,
    id: Option<ReferencableId>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SBAddStar {
    radius: f64,
    id: Option<ReferencableId>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SBTeleport {
    target: Vec2f64,
    rotation_rad: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SBAddAsteroidBelt {
    id: Option<ReferencableId>,
    width: f64,
    count: u32,
    radius: f64,
    full_period_ticks: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SBAddAsteroid {
    id: Option<ReferencableId>,
    radius: f64,
    position: Vec2f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SBSetupState {
    star: SBAddStar,
    planets: Vec<SBAddPlanet>,
    asteroid_belts: Vec<SBAddAsteroidBelt>,
    asteroids: Vec<SBAddAsteroid>,
    force_seed: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag", content = "fields")]
pub enum SandboxCommand {
    AddStar,
    AddMineral,
    AddContainer,
    ToggleGodMode,
    GetSomeWares,
    AddPlanet(SBAddPlanet),
    Teleport(SBTeleport),
    SetupState(SBSetupState),
}

pub fn init_saved_states() {
    let paths = fs::read_dir("resources/saved_states").unwrap();
    let mut saved_states = SAVED_STATES.lock().unwrap();

    for path in paths {
        let current_file = path.unwrap();
        let unwrapped = current_file.path().display().to_string();

        if unwrapped.ends_with(".gitkeep") {
            continue;
        }
        let json = fs::read_to_string(unwrapped).unwrap();
        let result = serde_json::from_str::<GameState>(json.as_str());
        if result.is_err() {
            panic!(
                "Failed to load saved state {}, err is {:?}",
                current_file.path().display(),
                result.err()
            );
        }
        let result = result.unwrap();
        let filename = current_file.file_name().into_string().unwrap();
        saved_states.insert(
            result.id,
            SavedState {
                name: filename,
                state: result,
            },
        );
    }
}

fn get_pos(state: &mut GameState, player_id: Uuid) -> Option<Vec2f64> {
    let ship = find_my_ship(state, player_id);
    ship.map(|s| s.spatial.position.clone())
}

pub fn mutate_state(state: &mut GameState, player_id: Uuid, cmd: SandboxCommand) {
    let mut prng = Pcg64Mcg::seed_from_u64(state.ticks);
    match cmd {
        SandboxCommand::AddStar => {
            if let Some(pos) = get_pos(state, player_id) {
                state.locations[0].star = Some(gen_star(new_id(), &mut prng, 50.0, pos));
                state.locations[0].planets = vec![];
            }
        }
        SandboxCommand::ToggleGodMode => {
            state.disable_hp_effects = !state.disable_hp_effects;
        }
        SandboxCommand::AddPlanet(args) => {
            if let Some(pos) = get_pos(state, player_id) {
                let mut planet_name_pool = PoolRandomPicker {
                    // TODO filter out existing planets
                    options: Vec::from(PLANET_NAMES),
                };
                let name = planet_name_pool.get(&mut prng).to_string();
                let mut planet = gen_planet_typed(args.p_type, prng_id(&mut prng));
                planet.name = name;
                planet.spatial.radius = args.radius;
                planet.movement = Movement::RadialMonotonous {
                    full_period_ticks: args.full_period_ticks,
                    anchor: ObjectSpecifier::Star {
                        id: map_id(args.anchor_id, &mut HashMap::new(), &mut prng),
                    },
                    relative_position: Default::default(),
                    phase: None,
                    start_phase: 0,
                };
                planet.anchor_tier =
                    find_anchor_tier(&state.locations[0], planet.movement.get_anchor_id());
                planet.spatial.position.x = pos.x;
                planet.spatial.position.y = pos.y;
                state.locations[0].planets.push(planet);
            }
        }
        SandboxCommand::Teleport(args) => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.spatial.position = args.target.clone();
                if let Some(rotation_rad) = args.rotation_rad {
                    ship.spatial.rotation_rad = rotation_rad;
                }
            } else {
                warn!("couldn't find player ship to teleport")
            }
        }
        SandboxCommand::GetSomeWares => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                add_free_stuff(ship, InventoryItemType::CommonMineral, 100);
                add_free_stuff(ship, InventoryItemType::UncommonMineral, 50);
                add_free_stuff(ship, InventoryItemType::RareMineral, 5);
                add_free_stuff(ship, InventoryItemType::Food, 500);
                add_free_stuff(ship, InventoryItemType::Medicament, 100);
                add_free_stuff(ship, InventoryItemType::HandWeapon, 50);
            }
        }
        SandboxCommand::AddMineral => {
            if let Some(loc) = indexing::find_my_ship_index(state, player_id) {
                let ship = &state.locations[loc.location_idx].ships[loc.ship_idx];
                let pos = ship.spatial.position.clone();
                let location = &mut state.locations[loc.location_idx];
                world::spawn_mineral(location, world::Rarity::Common, pos, &mut prng);
            }
        }
        SandboxCommand::AddContainer => {
            if let Some(loc) = indexing::find_my_ship_index(state, player_id) {
                let ship = &state.locations[loc.location_idx].ships[loc.ship_idx];
                let pos = ship.spatial.position.clone();
                let location = &mut state.locations[loc.location_idx];
                world::spawn_container(location, pos);
            }
        }
        SandboxCommand::SetupState(args) => {
            let loc_idx = 0;
            let mut prng = Pcg64Mcg::seed_from_u64(
                args.force_seed
                    .map(|s| str_to_hash(s))
                    .unwrap_or(state.ticks),
            );
            let loc = &mut state.locations[loc_idx];
            let mut id_storage = HashMap::new();
            if let Some(star_id) = args.star.id {
                let star_color = gen_star_color(&mut prng);
                loc.star = Some(Star {
                    id: map_id(star_id, &mut id_storage, &mut prng),
                    name: gen_star_name(&mut prng).to_string(),
                    color: star_color.0.to_string(),
                    corona_color: star_color.1.to_string(),
                    spatial: SpatialProps {
                        position: Vec2f64 { x: 0.0, y: 0.0 },
                        velocity: Default::default(),
                        angular_velocity: 0.0,
                        rotation_rad: 0.0,
                        radius: args.star.radius,
                    },
                    movement: Movement::None,
                    rot_movement: RotationMovement::None,
                });
            }
            let star_id = loc.star.as_ref().map_or(Uuid::default(), |s| s.id);
            loc.asteroid_belts = args
                .asteroid_belts
                .iter()
                .map(|sbb| AsteroidBelt {
                    id: map_id_opt(sbb.id.clone(), &mut id_storage, &mut prng),
                    spatial: SpatialProps {
                        position: Vec2f64::zero(),
                        velocity: Default::default(),
                        angular_velocity: 0.0,
                        rotation_rad: 0.0,
                        radius: sbb.radius,
                    },
                    width: sbb.width,
                    count: sbb.count,
                    movement: Movement::AnchoredStatic {
                        anchor: ObjectSpecifier::Star { id: star_id },
                    },
                    scale_mod: 0.0,
                    rot_movement: RotationMovement::Monotonous {
                        full_period_ticks: sbb.full_period_ticks,
                        phase: Some(0),
                        start_phase: 0,
                    },
                })
                .collect();
            loc.asteroids = args
                .asteroids
                .iter()
                .map(|s| Asteroid {
                    id: map_id_opt(s.id.clone(), &mut id_storage, &mut prng),
                    spatial: SpatialProps {
                        position: s.position,
                        velocity: Default::default(),
                        angular_velocity: 0.0,
                        rotation_rad: 0.0,
                        radius: s.radius,
                    },
                    movement: Movement::None,
                    rot_movement: RotationMovement::None,
                })
                .collect();
            loc.planets = args
                .planets
                .iter()
                .map(|spb| {
                    let anchor_id = map_id(spb.anchor_id.clone(), &mut id_storage, &mut prng);
                    let anchor = if anchor_id == star_id {
                        ObjectSpecifier::Star { id: anchor_id }
                    } else {
                        ObjectSpecifier::Planet { id: anchor_id }
                    };
                    PlanetV2 {
                        id: map_id_opt(spb.id.clone(), &mut id_storage, &mut prng),
                        name: gen_planet_name(&mut prng).to_string(),
                        spatial: SpatialProps {
                            position: Vec2f64 {
                                x: spb.position.x,
                                y: spb.position.y,
                            },
                            velocity: Default::default(),
                            angular_velocity: 0.0,
                            rotation_rad: 0.0,
                            radius: spb.radius,
                        },
                        anchor_tier: spb.anchor_tier,
                        color: gen_color(&mut prng).to_string(),
                        health: None,
                        properties: vec![],
                        movement: Movement::RadialMonotonous {
                            full_period_ticks: spb.full_period_ticks,
                            anchor,
                            relative_position: Default::default(),
                            phase: None,
                            start_phase: 0,
                        },
                        rot_movement: RotationMovement::None,
                    }
                })
                .collect();
        }
    }
}

type ReferencableIdStorage = HashMap<String, Uuid>;

fn map_id_opt(
    ref_id: Option<ReferencableId>,
    id_storage: &mut ReferencableIdStorage,
    prng: &mut Pcg64Mcg,
) -> Uuid {
    if let Some(id) = ref_id {
        map_id(id, id_storage, prng)
    } else {
        let mut bytes: [u8; 4] = [0; 4];
        prng.fill_bytes(&mut bytes);
        let hexed_ref = hex::encode(bytes);
        map_id(
            ReferencableId::Reference {
                reference: hexed_ref,
            },
            id_storage,
            prng,
        )
    }
}

fn map_id(
    ref_id: ReferencableId,
    id_storage: &mut ReferencableIdStorage,
    prng: &mut Pcg64Mcg,
) -> Uuid {
    match ref_id {
        ReferencableId::Id { id } => id,
        ReferencableId::Reference { reference } => {
            let entry = id_storage.entry(reference).or_insert(prng_id(prng));
            *entry
        }
    }
}

fn add_free_stuff(ship: &mut Ship, iit: InventoryItemType, quantity: i32) {
    add_item(
        &mut ship.inventory,
        InventoryItem {
            id: new_id(),
            index: 0,
            quantity,
            value: get_default_value(&iit),
            stackable: false,
            player_owned: false,
            item_type: iit,
            quest_id: None,
        },
    )
}

fn find_anchor_tier(loc: &Location, anchor_id: Uuid) -> u32 {
    let anchor_planet = loc.planets.iter().find(|p| p.id == anchor_id);
    if anchor_planet.is_none() {
        if let Some(star) = loc.star.as_ref() {
            if star.id == anchor_id {
                return 1;
            }
        }
        return 0;
    }
    let anchor_planet = anchor_planet.unwrap();
    return anchor_planet.anchor_tier + 1;
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SavedState {
    pub name: String,
    pub state: GameState,
}

pub type StateDictionary = HashMap<Uuid, SavedState>;
