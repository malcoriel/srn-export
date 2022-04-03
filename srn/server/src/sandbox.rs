use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};

use chrono::Utc;
use lazy_static::lazy_static;
use rand_pcg::Pcg64Mcg;
use rand::SeedableRng;
use uuid::Uuid;

use crate::{indexing, prng_id};
use crate::indexing::{find_my_ship, find_my_ship_mut};
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use crate::inventory::{add_item, InventoryItem, InventoryItemType};
use crate::market::get_default_value;
use crate::random_stuff::PLANET_NAMES;
use crate::system_gen::{gen_planet_typed, gen_star, PlanetType, PoolRandomPicker};
use crate::vec2::Vec2f64;
use crate::world::{GameState, Ship};
use crate::{new_id, world};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum SandboxTeleportTarget {
    Unknown,
    Zero,
}

lazy_static! {
    pub static ref SAVED_STATES: Arc<Mutex<Box<StateDictionary>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum SandboxCommand {
    AddStar,
    AddMineral,
    AddContainer,
    ToggleGodMode,
    GetSomeWares,
    AddPlanet {
        p_type: PlanetType,
        orbit_speed: f64,
        radius: f64,
        anchor_id: Uuid,
    },
    Teleport {
        target: SandboxTeleportTarget,
    },
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
    ship.map(|s| Vec2f64 { x: s.x, y: s.y })
}

pub fn mutate_state(state: &mut GameState, player_id: Uuid, cmd: SandboxCommand) {
    let mut prng = Pcg64Mcg::seed_from_u64(Utc::now().timestamp_millis() as u64);
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
        SandboxCommand::AddPlanet {
            p_type,
            orbit_speed,
            radius,
            anchor_id,
        } => {
            if let Some(pos) = get_pos(state, player_id) {
                let mut planet_name_pool = PoolRandomPicker {
                    // TODO filter out existing planets
                    options: Vec::from(PLANET_NAMES),
                };
                let name = planet_name_pool.get(&mut prng).to_string();
                let mut planet = gen_planet_typed(p_type, prng_id(&mut prng));
                planet.name = name;
                planet.radius = radius;
                planet.orbit_speed = orbit_speed;
                planet.anchor_id = anchor_id;
                planet.anchor_tier = get_anchor_tier(state, anchor_id);
                planet.x = pos.x;
                planet.y = pos.y;
                state.locations[0].planets.push(planet);
            }
        }
        SandboxCommand::Teleport { target } => {
            if target == SandboxTeleportTarget::Zero {
                if let Some(ship) = find_my_ship_mut(state, player_id) {
                    ship.x = 0.0;
                    ship.y = 0.0;
                }
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
                let pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let location = &mut state.locations[loc.location_idx];
                world::spawn_mineral(location, world::Rarity::Common, pos, &mut prng);
            }
        }
        SandboxCommand::AddContainer => {
            if let Some(loc) = indexing::find_my_ship_index(state, player_id) {
                let ship = &state.locations[loc.location_idx].ships[loc.ship_idx];
                let pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let location = &mut state.locations[loc.location_idx];
                world::spawn_container(location, pos);
            }
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

fn get_anchor_tier(state: &mut GameState, anchor_id: Uuid) -> u32 {
    let anchor_planet = state.locations[0]
        .planets
        .iter()
        .find(|p| p.id == anchor_id);
    if anchor_planet.is_none() {
        if let Some(star) = state.locations[0].star.as_ref() {
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
