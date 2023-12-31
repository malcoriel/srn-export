use std::borrow::{Borrow, BorrowMut};
use std::collections::{HashMap, HashSet, VecDeque};
use std::f64::consts::PI;
#[allow(deprecated)]
use std::f64::{INFINITY, NEG_INFINITY};
use std::fmt::{Display, Formatter};
use std::iter::FromIterator;

use crate::abilities::{Ability, SHOOT_COOLDOWN_TICKS};
use crate::api_struct::{new_bot, AiTrait, Bot, Room, RoomId};
use crate::autofocus::{build_spatial_index, object_index_into_object_id, SpatialIndex};
use crate::bots::{do_bot_npcs_actions, do_bot_players_actions, BOT_ACTION_TIME_TICKS};
use crate::cargo_rush::{CargoDeliveryQuestState, Quest};
use crate::combat::{
    acceleration_markers_to_string, guide_projectile, try_reacquire_target, update_explosions,
    Explosion, Health, Projectile, ShipTurret,
};
use crate::dialogue::Dialogue;
use crate::effects::{cleanup_effects, LocalEffect};
use crate::fof::FofOverrides;
use crate::hp::SHIP_REGEN_PER_SEC;
use crate::indexing::{
    build_full_spatial_indexes, find_my_player, find_my_ship, find_planet,
    find_player_and_ship_mut, find_player_ship_index, find_spatial_ref_by_spec,
    index_planets_by_id, index_players_by_ship_id, index_ships_by_id, index_state, GameStateCaches,
    GameStateIndexes, ObjectIndexSpecifier, ObjectSpecifier,
};
use crate::inventory::{
    add_item, add_items, has_quest_item, shake_items, InventoryItem, InventoryItemType,
};
use crate::long_actions::{
    cancel_all_long_actions_of_type, finish_long_act, finish_long_act_player, tick_long_act,
    tick_long_act_player, try_start_long_action_player_owned, try_start_long_action_ship_only,
    LongAction, LongActionPlayer, LongActionStart, MIN_SHIP_DOCKING_RADIUS,
    SHIP_DOCKING_RADIUS_COEFF,
};
use crate::market::{init_all_planets_market, Market};
use crate::notifications::{get_new_player_notifications, Notification, NotificationText};
use crate::perf::{Sampler, SamplerMarks};
use crate::planet_movement::IBodyV2;
use crate::properties::{
    cleanup_objects, update_properties_rules, MoneyOnKillProps, ObjectProperty, WRECK_DECAY_TICKS,
};
use crate::random_stuff::{
    gen_asteroid_radius, gen_asteroid_shift, gen_color, gen_mineral_props, gen_planet_count,
    gen_planet_gap, gen_planet_name, gen_planet_orbit_speed, gen_planet_radius,
    gen_random_photo_id, gen_sat_count, gen_sat_gap, gen_sat_name, gen_sat_orbit_speed,
    gen_sat_radius, gen_star_name, gen_star_radius,
};
use crate::sandbox::ReferencableId;
use crate::spatial_movement::{
    update_accelerated_movement, AccelerationMarkers, Movement, RotationMovement,
    EXTRA_PROJECTILE_TURN_DRAG,
};
use crate::substitutions::substitute_notification_texts;
use crate::system_gen::{seed_state, str_to_hash, GenStateOpts, DEFAULT_WORLD_UPDATE_EVERY_TICKS};
use crate::tractoring::{
    ContainersContainer, IMovable, MineralsContainer, MovablesContainer, MovablesContainerBase,
};
use crate::trajectory::{Trajectory, TrajectoryItem, TrajectoryResult};
use crate::vec2::{deg_to_rad, AsVec2f64, Precision, Vec2f64};
use crate::world_actions::*;
use crate::world_actions::{Action, ControlMarkers};
use crate::world_events::{world_update_handle_event, GameEvent, ProcessedGameEvent};
use crate::{
    abilities, autofocus, cargo_rush, combat, hp, indexing, pirate_defence, prng_id, random_stuff,
    spatial_movement, system_gen, trajectory, world_events,
};
use crate::{dialogue, vec2};
use crate::{fire_event, market, notifications, planet_movement, tractoring};
use crate::{get_prng, new_id, DEBUG_PHYSICS};
use crate::{seed_prng, DialogueTable};
use chrono::Utc;
use dialogue::DialogueStates;
use itertools::{Either, Itertools};
use rand::prelude::*;
use rand_pcg::Pcg64Mcg;
use serde_derive::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

pub type PlayerId = Uuid;

#[derive(
    Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TypescriptDefinition, TypeScriptify,
)]
pub enum GameMode {
    Unknown,
    CargoRush,
    Tutorial,
    Sandbox,
    PirateDefence,
}

impl Display for GameMode {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

pub fn get_random_planet<'a>(
    planets: &'a Vec<PlanetV2>,
    docked_at: Option<Uuid>,
    rng: &mut Pcg64Mcg,
) -> Option<&'a PlanetV2> {
    if planets.len() == 0 {
        return None;
    }
    let pickup = planets
        .into_iter()
        .filter(|p| p.id != docked_at.unwrap_or(Default::default()))
        .collect::<Vec<_>>();
    let from = &pickup[rng.gen_range(0, pickup.len())];
    Some(from)
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Default)]
// derive Serialize-Deserialize will add constraints itself, no need to explicitly mark them
pub struct SpatialProps {
    pub position: Vec2f64,
    pub velocity: Vec2f64,
    pub angular_velocity: f64,
    pub rotation_rad: f64,
    pub radius: f64,
}

impl SpatialProps {
    pub fn average_of(all: Vec<&SpatialProps>) -> SpatialProps {
        let mut pos = Vec2f64::zero();
        let mut vel = Vec2f64::zero();
        let mut rad = 0.0;
        let mut a_vel = 0.0;
        let mut rot = 0.0;
        let len = all.len() as f64;

        for prop in all {
            pos = pos.add(&prop.position);
            vel = vel.add(&prop.velocity);
            a_vel = a_vel + prop.angular_velocity;
            rad = rad + prop.radius;
            rot = rot + prop.rotation_rad;
        }
        SpatialProps {
            position: pos.scalar_mul(1.0 / len),
            velocity: vel.scalar_mul(1.0 / len),
            radius: rad / len,
            rotation_rad: rot / len,
            angular_velocity: a_vel / len,
        }
    }
}

pub trait WithSpatial {
    fn get_spatial(&self) -> &SpatialProps;
    fn get_spatial_mut(&mut self) -> &mut SpatialProps;
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct PlanetV2 {
    pub id: Uuid,
    pub name: String,
    pub spatial: SpatialProps,
    pub movement: Movement,
    pub rot_movement: RotationMovement,
    pub anchor_tier: u32,
    pub color: String,
    pub health: Option<Health>,
    pub properties: Vec<ObjectProperty>,
}

impl From<Box<dyn IBodyV2>> for PlanetV2 {
    fn from(b: Box<dyn IBodyV2>) -> Self {
        b.as_any().downcast_ref::<PlanetV2>().unwrap().clone()
    }
}

impl From<&Box<dyn IBodyV2>> for PlanetV2 {
    fn from(b: &Box<dyn IBodyV2>) -> Self {
        b.as_any().downcast_ref::<PlanetV2>().unwrap().clone()
    }
}

impl PlanetV2 {
    pub fn get_anchor_ref<'a>(&self, loc: &'a Location) -> Box<&'a dyn IBodyV2> {
        match &self.movement {
            Movement::RadialMonotonous { anchor, .. } => Box::new(match anchor {
                ObjectSpecifier::Planet { id } => loc
                    .planets
                    .iter()
                    .find(|p| p.id == *id)
                    .expect("no anchor found by id {id}"),
                ObjectSpecifier::Star { id } => loc
                    .star
                    .as_ref()
                    .expect(format!("no anchor found by id {}", id).as_str()),
                _ => panic!(
                    "invalid anchor {anchor:?} for planet {}, cannot get ref to it",
                    self.id
                ),
            }),
            _ => panic!(
                "invalid movement definition for planet {}, cannot get anchor",
                self.id
            ),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Asteroid {
    pub id: Uuid,
    pub spatial: SpatialProps,
    pub movement: Movement,
    pub health: Health,
    pub rot_movement: RotationMovement,
    pub to_clean: bool,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct AsteroidBelt {
    pub id: Uuid,
    pub spatial: SpatialProps,
    pub width: f64,
    pub count: u32,
    pub movement: Movement,
    pub scale_mod: f64,
    pub rot_movement: RotationMovement,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Star {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub corona_color: String,
    pub spatial: SpatialProps,
    pub movement: Movement,
    pub rot_movement: RotationMovement,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypeScriptify, TypescriptDefinition)]
pub struct ProcessedPlayerAction {
    pub action: Action,
    pub processed_at_ticks: u64,
    pub packet_tag: Option<String>,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Ship {
    pub id: Uuid,
    pub spatial: SpatialProps,
    pub color: String,
    pub docked_at: Option<Uuid>,
    pub tractor_target: Option<Uuid>,
    pub navigate_target: Option<Vec2f64>,
    pub dock_target: Option<Uuid>,
    pub trajectory: Vec<Vec2f64>,
    pub trajectory_v2: TrajectoryResult,
    pub inventory: Vec<InventoryItem>,
    pub abilities: Vec<Ability>,
    pub auto_focus: Option<ObjectSpecifier>,
    pub hostile_auto_focus: Option<ObjectSpecifier>,
    pub movement_markers: ControlMarkers,
    pub movement_definition: Movement,
    pub health: Health,
    pub long_actions: Vec<LongAction>,
    pub npc: Option<Bot>,
    pub name: Option<String>,
    pub turrets: Vec<ShipTurret>,
    pub properties: Vec<ObjectProperty>,
    pub trading_with: Option<ObjectSpecifier>,
    pub fof_overrides: Option<FofOverrides>,
    pub markers: Option<String>,
    pub acceleration_markers: Option<AccelerationMarkers>,
    pub to_clean: bool,
}

pub enum TemplateId {
    Unknown,
    Rocket,
}

impl Ship {
    pub fn new(prng: &mut Pcg64Mcg, at: &mut Option<Vec2f64>) -> Ship {
        let turrets = combat::gen_turrets(2, prng);
        Ship {
            id: prng_id(prng),
            color: gen_color(prng).to_string(),
            spatial: SpatialProps {
                position: Vec2f64 {
                    x: if at.is_some() { at.unwrap().x } else { 100.0 },
                    y: if at.is_some() { at.unwrap().y } else { 100.0 },
                },
                velocity: Default::default(),
                angular_velocity: 0.0,
                rotation_rad: 0.0,
                radius: 2.0,
            },
            docked_at: None,
            tractor_target: None,
            navigate_target: None,
            dock_target: None,
            trajectory: vec![],
            trajectory_v2: TrajectoryResult::Inaccessible,
            inventory: vec![],
            abilities: turrets.iter().map(|(a, _t)| a.clone()).collect(),
            turrets: turrets.iter().map(|(_a, t)| t.clone()).collect(),
            auto_focus: None,
            hostile_auto_focus: None,
            movement_markers: Default::default(),
            movement_definition: Movement::None,
            health: Health::new(100.0),
            long_actions: vec![],
            npc: None,
            name: None,
            properties: Default::default(),
            trading_with: None,
            fof_overrides: None,
            markers: None,
            acceleration_markers: None,
            to_clean: false,
        }
    }
}

impl Ship {
    pub fn set_from(&mut self, pos: &Vec2f64) {
        self.spatial.position.x = pos.x;
        self.spatial.position.y = pos.y;
    }
    pub fn as_vec(&self) -> Vec2f64 {
        self.spatial.position.clone()
    }
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Player {
    pub id: Uuid,
    pub is_bot: bool,
    pub ship_id: Option<Uuid>,
    pub name: String,
    pub quest: Option<Quest>,
    pub money: i32,
    pub portrait_name: String,
    pub respawn_ms_left: i32,
    pub long_actions: Vec<LongActionPlayer>,
    pub notifications: Vec<Notification>,
}

impl Player {
    pub fn new(id: Uuid, mode: &GameMode, prng: &mut Pcg64Mcg) -> Self {
        Player {
            id,
            is_bot: false,
            ship_id: None,
            name: "question".to_string(),
            quest: None,
            money: 0,
            portrait_name: "".to_string(),
            respawn_ms_left: 0,
            long_actions: vec![],
            notifications: get_new_player_notifications(mode, prng),
        }
    }
    pub fn set_quest(&mut self, q: Option<Quest>) {
        self.quest = q;
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Leaderboard {
    pub rating: Vec<(Uuid, u32, String)>,
    pub winner: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub enum Rarity {
    Unknown,
    Common,
    Uncommon,
    Rare,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct NatSpawnMineral {
    pub x: f64,
    pub y: f64,
    pub id: Uuid,
    pub radius: f64,
    pub value: i32,
    pub rarity: Rarity,
    pub color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Container {
    pub id: Uuid,
    pub items: Vec<InventoryItem>,
    pub position: Vec2f64,
    pub radius: f64,
}

impl Container {
    pub fn new(id: Uuid) -> Self {
        Container {
            id,
            items: vec![],
            position: Default::default(),
            radius: Self::calc_radius(&vec![]),
        }
    }

    pub fn calc_radius(items: &Vec<InventoryItem>) -> f64 {
        return (items
            .iter()
            .fold(0.0, |acc, curr| acc + curr.quantity as f64)
            / 5.0)
            .max(2.0)
            .min(3.0);
    }

    pub fn random(prng: &mut Pcg64Mcg) -> Self {
        let mut cont = Container::new(prng_id(prng));
        for _i in 0..prng.gen_range(1, 5) {
            cont.items.push(InventoryItem::random(prng))
        }
        cont.radius = Container::calc_radius(&cont.items);
        cont.position = Vec2f64 {
            x: prng.gen_range(WORLD_MIN_X / 2.0, WORLD_MAX_X / 2.0),
            y: prng.gen_range(WORLD_MIN_Y / 2.0, WORLD_MAX_Y / 2.0),
        };
        cont
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Default)]
pub struct ProcessProps {
    pub progress_normalized: f64,
    pub remaining_ticks: i32,
    pub max_ticks: i32,
}

impl ProcessProps {
    pub fn from(ticks: i32) -> ProcessProps {
        ProcessProps {
            progress_normalized: 0.0,
            remaining_ticks: ticks,
            max_ticks: ticks,
        }
    }
    pub fn apply(&mut self, elapsed: i32) -> bool {
        self.remaining_ticks = (self.remaining_ticks - elapsed).max(0);
        self.progress_normalized = 1.0 - (self.remaining_ticks as f64 / self.max_ticks as f64);
        self.remaining_ticks <= 0
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Wreck {
    pub spatial: SpatialProps,
    pub id: Uuid,
    pub color: String,
    pub properties: Vec<ObjectProperty>,
    pub to_clean: bool,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Location {
    pub seed: String,
    pub id: Uuid,
    pub star: Option<Star>,
    pub planets: Vec<PlanetV2>,
    pub asteroids: Vec<Asteroid>,
    pub wrecks: Vec<Wreck>,
    pub minerals: Vec<NatSpawnMineral>,
    pub containers: Vec<Container>,
    pub position: Vec2f64,
    pub asteroid_belts: Vec<AsteroidBelt>,
    pub ships: Vec<Ship>,
    pub adjacent_location_ids: Vec<Uuid>,
    pub projectiles: Vec<Projectile>,
    pub explosions: Vec<Explosion>,
    pub effects: Vec<LocalEffect>,
    pub short_counter: i32,
}

impl Location {
    pub fn new_empty(id: Uuid) -> Self {
        Location {
            seed: "".to_string(),
            id,
            star: None,
            planets: vec![],
            asteroids: vec![],
            wrecks: vec![],
            minerals: vec![],
            containers: vec![],
            position: Default::default(),
            asteroid_belts: vec![],
            ships: vec![],
            adjacent_location_ids: vec![],
            projectiles: Default::default(),
            explosions: vec![],
            effects: vec![],
            short_counter: 0,
        }
    }

    pub fn new_star_system(id: Uuid) -> Location {
        Location {
            id,
            adjacent_location_ids: vec![],
            seed: "empty".to_string(),
            star: None,
            planets: vec![],
            asteroids: vec![],
            wrecks: vec![],
            minerals: vec![],
            containers: vec![],
            position: Vec2f64 { x: 0.0, y: 0.0 },
            asteroid_belts: vec![],
            ships: vec![],
            projectiles: Default::default(),
            explosions: vec![],
            effects: vec![],
            short_counter: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct LocationLink {
    pub from: Uuid,
    pub to: Uuid,
}

impl Location {}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ShipWithTime {
    pub ship: Ship,
    pub at_ticks: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Breadcrumb {
    pub position: Vec2f64,
    pub color: String,
    pub timestamp_ticks: u64,
    pub tag: Option<String>,
    pub extra_size: i32,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct GameState {
    pub id: Uuid,
    pub version: u32,
    pub mode: GameMode,
    pub tag: Option<String>,
    pub seed: String,
    pub next_seed: Option<u32>,
    pub my_id: Uuid,
    pub start_time_ticks: u64,
    pub players: Vec<Player>,
    pub milliseconds_remaining: i32,
    pub paused: bool,
    pub leaderboard: Option<Leaderboard>,
    pub millis: u32,
    pub ticks: u64,
    pub market: Option<Market>,
    pub locations: Vec<Location>,
    pub interval_data: Option<HashMap<TimeMarks, u32>>,
    pub game_over: Option<GameOver>,
    pub events: Option<VecDeque<GameEvent>>,
    // (action, packet_tag_that_received_it, ticks_at)
    pub player_actions: VecDeque<(Action, Option<String>, Option<u64>)>,
    pub processed_events: Vec<ProcessedGameEvent>,
    pub processed_player_actions: Vec<ProcessedPlayerAction>,
    pub update_every_ticks: u64,
    pub accumulated_not_updated_ticks: u32,
    pub gen_opts: Option<GenStateOpts>,
    pub dialogue_states: Option<DialogueStates>,
    pub breadcrumbs: Option<Vec<Breadcrumb>>,
    pub projectile_templates: Option<Vec<Projectile>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct GameOver {
    pub reason: String,
}

pub const GAME_STATE_VERSION: u32 = 4;

impl GameState {
    pub fn new() -> Self {
        Self {
            id: Default::default(),
            version: GAME_STATE_VERSION,
            mode: GameMode::Unknown,
            tag: None,
            seed: "".to_string(),
            next_seed: None,
            my_id: Default::default(),
            start_time_ticks: 0,
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            millis: 0,
            ticks: 0,
            market: None,
            locations: vec![],
            interval_data: Some(Default::default()),
            game_over: None,

            events: Some(Default::default()),
            player_actions: Default::default(),
            processed_events: vec![],
            processed_player_actions: vec![],
            update_every_ticks: DEFAULT_WORLD_UPDATE_EVERY_TICKS,
            accumulated_not_updated_ticks: 0,
            gen_opts: Default::default(),
            dialogue_states: Some(Default::default()),
            breadcrumbs: None,
            projectile_templates: None,
        }
    }
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct AABB {
    pub top_left: Vec2f64,
    pub bottom_right: Vec2f64,
}

const WORLD_MIN_Y: f64 = -500.0;
const WORLD_MIN_X: f64 = -500.0;
const WORLD_MAX_Y: f64 = 500.0;
const WORLD_MAX_X: f64 = 500.0;

impl AABB {
    pub fn maxed() -> AABB {
        AABB {
            top_left: Vec2f64 {
                x: WORLD_MIN_X,
                y: WORLD_MIN_Y,
            },
            bottom_right: Vec2f64 {
                x: WORLD_MAX_X,
                y: WORLD_MAX_Y,
            },
        }
    }
    pub fn contains_body(&self, body: &Box<dyn IBodyV2>) -> bool {
        let spatial = body.get_spatial();
        self.contains_spatial(spatial)
    }

    pub fn contains_spatial(&self, spatial: &SpatialProps) -> bool {
        let x = spatial.position.x;
        let y = spatial.position.y;
        let radius = spatial.radius;
        return self.top_left.x <= (x - radius)
            && (x + radius) <= self.bottom_right.x
            && self.top_left.y <= (y - radius)
            && (y + radius) <= self.bottom_right.y;
    }

    pub fn contains_vec(&self, vec: &Vec2f64) -> bool {
        return self.top_left.x <= vec.x
            && vec.x <= self.bottom_right.x
            && self.top_left.y <= vec.y
            && vec.y <= self.bottom_right.y;
    }
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct UpdateOptions {
    pub limit_area: AABB,
    pub force_non_determinism: Option<bool>,
}

impl UpdateOptions {
    pub fn new() -> Self {
        Self {
            limit_area: AABB::maxed(),
            force_non_determinism: None,
        }
    }
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct UpdateOptionsV2 {
    pub limit_area: Option<AABB>,
    pub limit_to_loc_idx: Option<usize>,
}

impl UpdateOptionsV2 {
    pub fn new() -> Self {
        Self {
            limit_area: None,
            limit_to_loc_idx: None,
        }
    }
}

pub struct SpatialIndexes {
    pub values: HashMap<usize, SpatialIndex>,
}

impl SpatialIndexes {
    pub fn new() -> Self {
        SpatialIndexes {
            values: Default::default(),
        }
    }
}

pub fn update_world(
    state: GameState,
    elapsed: i64,
    client: bool,
    mut sampler: Sampler,
    update_options: UpdateOptions,
    prng: &mut Pcg64Mcg,
    d_table: &DialogueTable,
    caches: &mut GameStateCaches,
) -> (GameState, Sampler, SpatialIndexes) {
    let update_full_mark = sampler.start(SamplerMarks::UpdateWorldFull as u32);
    let mut remaining = elapsed + state.accumulated_not_updated_ticks as i64;
    let (mut curr_state, mut curr_sampler) = (state, sampler);
    let fast_nondeterministic_update = update_options.force_non_determinism.unwrap_or(false);

    let spatial_index_result: SpatialIndexes = if !fast_nondeterministic_update {
        let update_interval = curr_state.update_every_ticks as i64;
        while remaining >= update_interval {
            // executes update 'as one', which may be especially invalid
            let spatial_indexes_id = curr_sampler.start(SamplerMarks::GenFullSpatialIndexes as u32);
            let mut spatial_indexes = indexing::build_full_spatial_indexes(&curr_state);
            curr_sampler.end(spatial_indexes_id);
            let iter_mark = curr_sampler.start(SamplerMarks::UpdateWorldIter as u32);
            let pair = update_world_iter(
                curr_state,
                update_interval,
                client,
                curr_sampler,
                update_options.clone(),
                &mut spatial_indexes,
                prng,
                d_table,
                caches,
            );
            remaining -= update_interval;
            curr_state = pair.0;
            curr_sampler = pair.1;
            curr_sampler.end(iter_mark);
        }
        curr_state.accumulated_not_updated_ticks = remaining as u32;
        // must do the last rebuild because otherwise bot actions that come next, might end up using a corrupted index
        build_full_spatial_indexes(&curr_state)
    } else {
        // executes update 'as one', which may be especially invalid for big intervals with relation to spatial indexes
        // as they won't get updated between small intervals, meaning that some events depending on that, e.g.
        // sequence of explosions won't work as expected
        let spatial_indexes_id = curr_sampler.start(SamplerMarks::GenFullSpatialIndexes as u32);
        let mut spatial_indexes = indexing::build_full_spatial_indexes(&curr_state);
        curr_sampler.end(spatial_indexes_id);
        let mark = curr_sampler.start(SamplerMarks::UpdateWorldNonDetIter as u32);
        let pair = update_world_iter(
            curr_state,
            remaining,
            client,
            curr_sampler,
            update_options.clone(),
            &mut spatial_indexes,
            prng,
            d_table,
            caches,
        );
        curr_state = pair.0;
        curr_sampler = pair.1;
        curr_state.accumulated_not_updated_ticks = 0;
        curr_sampler.end(mark);
        // must do the last rebuild because otherwise bot actions that come next, might end up using a corrupted index
        build_full_spatial_indexes(&curr_state)
    };
    curr_sampler.end(update_full_mark);
    (curr_state, curr_sampler, spatial_index_result)
}

fn update_world_iter(
    mut state: GameState,
    elapsed: i64,
    client: bool,
    sampler: Sampler,
    update_options: UpdateOptions,
    spatial_indexes: &mut SpatialIndexes,
    prng: &mut Pcg64Mcg,
    d_table: &DialogueTable,
    caches: &mut GameStateCaches,
) -> (GameState, Sampler) {
    state.ticks += elapsed as u64;
    state.millis = (state.ticks as f64 / 1000.0) as u32;
    if state.mode != GameMode::Tutorial {
        state.milliseconds_remaining -= elapsed as i32 / 1000;
    }

    let mut sampler = sampler;

    let events_id = sampler.start(SamplerMarks::UpdateEvents as u32);
    update_events(&mut state, prng, client, d_table);
    sampler.end(events_id);

    let player_actions_id = sampler.start(SamplerMarks::UpdatePlayerActions as u32);
    update_player_actions(&mut state, prng, d_table, client);
    sampler.end(player_actions_id);

    let rules_id = sampler.start(SamplerMarks::UpdateRuleSpecific as u32);
    update_rule_specifics(&mut state, prng, &mut sampler, client);
    sampler.end(rules_id);

    if state.paused {
        if !client {
            if state.milliseconds_remaining <= 500 {
                let players = state
                    .players
                    .clone()
                    .into_iter()
                    .map(|mut p| {
                        p.quest = None;
                        p.money = 0;
                        p
                    })
                    .collect::<Vec<_>>();
                state = seed_state(
                    &state.mode,
                    random_stuff::random_hex_seed(),
                    state.gen_opts,
                    caches,
                );
                state.players = players.clone();
                for player in players.iter() {
                    spawn_ship(
                        &mut state,
                        Some(player.id),
                        ShipTemplate::player(None),
                        prng,
                    );
                }
                fire_event(GameEvent::GameStarted { state_id: state.id });
            } else {
            }
        }
    } else {
        if !client {
            let update_leaderboard_id = sampler.start(SamplerMarks::UpdateLeaderboard as u32);
            state.leaderboard = cargo_rush::make_leaderboard(&state.players);
            sampler.end(update_leaderboard_id);

            if state.mode == GameMode::CargoRush {
                if state
                    .market
                    .as_ref()
                    .map_or(false, |m| m.time_before_next_shake > 0)
                {
                    state
                        .market
                        .as_mut()
                        .map(|m| m.time_before_next_shake -= elapsed);
                } else {
                    let market_update_start = sampler.start(SamplerMarks::UpdateMarket as u32);
                    let planets_clone = state.locations[0]
                        .planets
                        .iter()
                        .map(|p| p.clone())
                        .collect::<Vec<_>>();
                    let new_market = if let Some(market) = &state.market {
                        let mut wares = market.wares.clone();
                        let mut prices = market.prices.clone();
                        market::shake_market(planets_clone, &mut wares, &mut prices, prng);
                        Some(Market {
                            wares,
                            prices,
                            time_before_next_shake: market::SHAKE_MARKET_EVERY_TICKS,
                        })
                    } else {
                        None
                    };
                    state.market = new_market;
                    sampler.end(market_update_start);
                }
            }
        }

        let long_act_ticks = sampler.start(SamplerMarks::UpdateTickLongActions as u32);
        let mut to_finish = vec![];
        for player in state.players.iter_mut() {
            player.long_actions = player
                .long_actions
                .clone()
                .into_iter()
                .filter_map(|la| {
                    let (new_la, keep_ticking) = tick_long_act_player(la, elapsed);
                    if !keep_ticking {
                        to_finish.push((new_la.clone(), player.id));
                    }
                    return if keep_ticking { Some(new_la) } else { None };
                })
                .collect();
        }
        for (act, player_id) in to_finish.into_iter() {
            finish_long_act_player(&mut state, player_id, act, client, prng);
        }

        sampler.end(long_act_ticks);

        let time_end = state.milliseconds_remaining <= 0;
        let game_over_end = state.game_over.is_some();
        if time_end || game_over_end {
            if time_end {
                // log!("Game ended due to time limit");
            } else if game_over_end {
                // log!("Game ended due to game over trigger");
            }
            state.paused = true;
            state.milliseconds_remaining = 10 * 1000;
            fire_event(GameEvent::GameEnded { state_id: state.id });
            for player in state.players.iter_mut() {
                player.long_actions = vec![];
            }
        } else {
            // the client only operates with the first location,
            // so to conserve effort we skip the others
            let max_loc = if client { 1 } else { state.locations.len() };
            let state_read_clone = state.clone();
            let mut indexes = index_state(&state_read_clone);

            for location_idx in 0..max_loc {
                sampler = update_location(
                    &mut state,
                    elapsed,
                    client,
                    &update_options,
                    sampler,
                    location_idx,
                    spatial_indexes,
                    &mut indexes,
                    caches,
                    prng,
                )
            }
        };
    };
    (state, sampler)
}

pub const PROCESSED_ACTION_LIFETIME_TICKS: u64 = 10 * 1000 * 1000;

fn update_player_actions(
    state: &mut GameState,
    prng: &mut Pcg64Mcg,
    d_table: &DialogueTable,
    client: bool,
) {
    let state_clone = state.clone();
    let mut actions_to_process = vec![];
    while let Some(event) = state.player_actions.pop_front() {
        actions_to_process.push(event);
    }
    let mut processed_actions = vec![];
    for action in actions_to_process.into_iter() {
        world_update_handle_action(
            state,
            action.0.clone(),
            prng,
            &state_clone,
            d_table,
            action.2.clone(),
            client,
        );
        let processed_action = ProcessedPlayerAction {
            action: action.0,
            packet_tag: action.1,
            processed_at_ticks: state.ticks,
        };
        processed_actions.push(processed_action);
    }
    let cutoff = if state.ticks > PROCESSED_ACTION_LIFETIME_TICKS {
        state.ticks - PROCESSED_ACTION_LIFETIME_TICKS
    } else {
        0
    };
    state
        .processed_player_actions
        .retain(|pa| pa.processed_at_ticks >= cutoff);
    state
        .processed_player_actions
        .append(&mut processed_actions);
}

const PROCESSED_EVENT_LIFETIME_TICKS: i32 = 10 * 1000 * 1000;

fn update_events(
    state: &mut GameState,
    prng: &mut Pcg64Mcg,
    client: bool,
    d_table: &DialogueTable,
) {
    if client {
        return;
    }
    let mut events_to_process = vec![];
    while let Some(event) = state.events.as_mut().and_then(|ev| ev.pop_front()) {
        events_to_process.push(event);
    }
    let mut processed_events = vec![];
    let current_state_ticks = state.ticks;
    for event in events_to_process.into_iter() {
        world_update_handle_event(state, prng, event.clone(), d_table);
        let processed_event = ProcessedGameEvent::from(event, current_state_ticks);
        processed_events.push(processed_event);
    }
    state.processed_events.retain(|pe| {
        (pe.get_processed_at_ticks() as i32 - current_state_ticks as i32).abs()
            <= PROCESSED_EVENT_LIFETIME_TICKS
    });
    state.processed_events.append(&mut processed_events);
}

pub fn update_location(
    mut state: &mut GameState,
    elapsed: i64,
    client: bool,
    update_options: &UpdateOptions,
    mut sampler: Sampler,
    loc_idx: usize,
    spatial_indexes: &mut SpatialIndexes,
    indexes: &mut GameStateIndexes,
    caches: &mut GameStateCaches,
    prng: &mut Pcg64Mcg,
) -> Sampler {
    let current_tick = state.ticks;
    let next_ticks = state.ticks as u64 + elapsed as u64;
    let spatial_index_id = sampler.start(SamplerMarks::GenSpatialIndexOnDemand as u32);
    let spatial_index = spatial_indexes
        .values
        .entry(loc_idx)
        // lazily build the spatial indexes if this function wasn't executed with pre-building full ones
        .or_insert_with(|| {
            warn2!("spatial index cache miss");
            build_spatial_index(&state.locations[loc_idx], loc_idx)
        });
    sampler.end(spatial_index_id);
    let update_radials_id = sampler.start(SamplerMarks::UpdateLocationRadialMovement as u32);
    let (location, sampler_out) = planet_movement::update_radial_moving_entities(
        &state.locations[loc_idx],
        next_ticks,
        sampler,
        update_options.limit_area.clone(),
        indexes,
        caches,
    );
    state.locations[loc_idx] = location;
    sampler = sampler_out;
    sampler.end(update_radials_id);
    let update_docked_ships_id = sampler.start(SamplerMarks::UpdateDockedShipsPosition as u32);
    // strictly speaking, indexes are outdated here because we have just updated the planet rotation, but we'll deliberately use 'previous frame location' as good enough
    spatial_movement::update_docked_ships_position(&mut state.locations[loc_idx], indexes);
    sampler.end(update_docked_ships_id);
    let update_ships_navigation_id = sampler.start(SamplerMarks::UpdateShipsNavigation as u32);
    spatial_movement::update_ships_navigation(
        &mut state.locations[loc_idx].ships,
        elapsed,
        client,
        update_options,
        indexes,
        state.update_every_ticks,
        caches,
        state.ticks,
    );
    sampler.end(update_ships_navigation_id);
    if !client {
        let initiate_docking_id =
            sampler.start(SamplerMarks::UpdateInitiateShipsDockingByNavigation as u32);
        spatial_movement::update_initiate_ship_docking_by_navigation(state, loc_idx, prng);
        sampler.end(initiate_docking_id);
    }
    let interpolate_docking_id = sampler.start(SamplerMarks::UpdateInterpolateDockingShips as u32);
    spatial_movement::interpolate_docking_ships_position(state, loc_idx, update_options);
    sampler.end(interpolate_docking_id);
    let update_ship_manual_movement_id =
        sampler.start(SamplerMarks::UpdateObjectsSpatialMovement as u32);
    spatial_movement::update_objects_spatial_movement(
        &mut state.locations[loc_idx],
        elapsed,
        state.millis,
        client,
    );
    sampler.end(update_ship_manual_movement_id);

    let update_ship_tractoring_id = sampler.start(SamplerMarks::UpdateShipsTractoring as u32);
    if !client {
        state.locations[loc_idx].ships = tractoring::update_ships_tractoring(
            &state.locations[loc_idx].ships,
            &state.locations[loc_idx].minerals,
            &state.locations[loc_idx].containers,
        );
    }
    sampler.end(update_ship_tractoring_id);
    let cooldowns_id = sampler.start(SamplerMarks::UpdateAbilityCooldowns as u32);
    abilities::update_ships_ability_cooldowns(&mut state.locations[loc_idx].ships, elapsed);
    sampler.end(cooldowns_id);

    let update_minerals_id = sampler.start(SamplerMarks::UpdateTractoredMinerals as u32);
    let mut container =
        MovablesContainerBase::new_minerals(state.locations[loc_idx].minerals.clone());
    let consume_updates = tractoring::update_tractored_objects(
        &state.locations[loc_idx].ships,
        &mut container.movables,
        elapsed,
        &state.players,
    );
    state.locations[loc_idx].minerals = container.get_minerals();
    if !client {
        apply_tractored_items_consumption(&mut state, consume_updates, client)
    }
    sampler.end(update_minerals_id);
    let update_containers_id = sampler.start(SamplerMarks::UpdateTractoredContainers as u32);
    let mut container =
        MovablesContainerBase::new_containers(state.locations[loc_idx].containers.clone());
    let consume_updates = tractoring::update_tractored_objects(
        &state.locations[loc_idx].ships,
        &mut container.movables,
        elapsed,
        &state.players,
    );
    state.locations[loc_idx].containers = container.get_containers();
    if !client {
        apply_tractored_items_consumption(&mut state, consume_updates, client)
    }
    sampler.end(update_containers_id);

    let guidance_id = sampler.start(SamplerMarks::UpdateObjectAutocontrol as u32);

    let mut target_spatials = vec![];
    for proj in state.locations[loc_idx].projectiles.iter() {
        if let Some(target) = &proj.get_target() {
            if let Some(spatial) = find_spatial_ref_by_spec(indexes, target.clone()) {
                target_spatials.push(Some(spatial));
            } else {
                target_spatials.push(None);
            }
        } else {
            target_spatials.push(None);
        }
    }

    let mut proj_target_mods = vec![];

    for (idx, proj) in state.locations[loc_idx].projectiles.iter().enumerate() {
        if target_spatials[idx].is_none() {
            if let Some(new_target_idx) = try_reacquire_target(
                ObjectIndexSpecifier::Projectile { idx },
                &proj.get_spatial().position,
                spatial_index,
                state,
                loc_idx,
            ) {
                proj_target_mods.push((
                    idx,
                    object_index_into_object_id(&new_target_idx, &state.locations[loc_idx])
                        .unwrap(),
                ))
            }
        }
    }

    for (idx, new_target_idx) in proj_target_mods.into_iter() {
        state.locations[loc_idx].projectiles[idx].set_target(&new_target_idx);
    }

    for (idx, proj) in state.locations[loc_idx].projectiles.iter_mut().enumerate() {
        let movement_clone = proj.get_movement().clone();
        let (gas, turn, brake) = if let Some(target_spatial) = &target_spatials[idx] {
            let (gas, turn, brake) = guide_projectile(proj, target_spatial, elapsed);
            *proj.get_markers_mut() = acceleration_markers_to_string(gas, turn, brake);
            (gas, turn, brake)
        } else {
            (1.0, 0.0, 0.0)
        };
        update_accelerated_movement(
            elapsed,
            proj.get_spatial_mut(),
            &movement_clone,
            gas,
            turn,
            brake,
            EXTRA_PROJECTILE_TURN_DRAG,
        );
        match proj {
            Projectile::Rocket(props) => {
                props.gas = gas;
                props.turn = turn;
                props.brake = brake;
            }
        }
    }
    sampler.end(guidance_id);

    let collisions_id = sampler.start(SamplerMarks::UpdateProjectileCollisions as u32);
    let projectile_hit_damages = combat::update_projectile_collisions(
        &mut state.locations[loc_idx],
        update_options,
        spatial_index,
        loc_idx,
        indexes,
        current_tick,
        prng,
    );
    sampler.end(collisions_id);

    let props_id = sampler.start(SamplerMarks::UpdatePropertiesRules as u32);
    update_properties_rules(
        &mut state.locations[loc_idx],
        update_options,
        spatial_index,
        indexes,
        loc_idx,
        elapsed as i32,
    );
    sampler.end(props_id);

    let hp_effects_id = sampler.start(SamplerMarks::UpdateHpEffects as u32);
    hp::update_hp_effects(
        state,
        loc_idx,
        elapsed,
        prng,
        client,
        projectile_hit_damages,
        spatial_index,
        indexes,
    );
    sampler.end(hp_effects_id);

    let update_minerals_respawn_id = sampler.start(SamplerMarks::UpdateMineralsRespawn as u32);
    state.locations[loc_idx].minerals = update_state_minerals(
        &state.locations[loc_idx].minerals,
        &state.locations[loc_idx].asteroid_belts,
        prng,
    );
    sampler.end(update_minerals_respawn_id);
    let respawn_id = sampler.start(SamplerMarks::UpdateShipsRespawn as u32);
    update_ships_respawn(&mut state, prng);
    sampler.end(respawn_id);

    let autofocus_id = sampler.start(SamplerMarks::UpdateAutofocus as u32);
    autofocus::update_location_autofocus(&mut state, loc_idx, &spatial_index, client);
    sampler.end(autofocus_id);

    let long_act_ticks = sampler.start(SamplerMarks::UpdateTickLongActionsShips as u32);
    let players_read = state.players.clone();
    let players_by_ship_id_read = index_players_by_ship_id(&players_read);
    let mut to_finish = vec![];

    for i in 0..state.locations[loc_idx].ships.len() {
        let ship = &mut state.locations[loc_idx].ships[i];
        ship.long_actions = ship
            .long_actions
            .clone()
            .into_iter()
            .filter_map(|la| {
                let (new_la, keep_ticking) = tick_long_act(la, elapsed);
                if !keep_ticking {
                    let player = players_by_ship_id_read.get(&ship.id);
                    to_finish.push((
                        new_la.clone(),
                        player.map(|p| p.id),
                        ShipIdx {
                            ship_idx: i,
                            location_idx: loc_idx,
                        },
                    ));
                }
                return if keep_ticking { Some(new_la) } else { None };
            })
            .collect();
    }
    for (act, player_id, ship_idx) in to_finish.into_iter() {
        finish_long_act(&mut state, player_id, act, client, ship_idx, prng, indexes);
    }
    sampler.end(long_act_ticks);

    let exp_id = sampler.start(SamplerMarks::UpdateExplosions as u32);
    update_explosions(
        &mut state.locations[loc_idx],
        elapsed as i32,
        spatial_index,
        indexes,
        state.ticks,
        prng,
    );
    sampler.end(exp_id);

    let clean = sampler.start(SamplerMarks::UpdateCleanup as u32);
    cleanup_effects(&mut state, loc_idx);
    cleanup_objects(&mut state, loc_idx);
    sampler.end(clean);
    sampler
}

pub fn lerp(from: f64, to: f64, percentage: f64) -> f64 {
    return vec2::reduce_precision((to - from) * (percentage.max(0.0).min(1.0)) + from);
}

fn apply_tractored_items_consumption(
    mut state: &mut &mut GameState,
    consume_updates: Vec<(Uuid, Box<dyn IMovable>)>,
    _client: bool,
) {
    for pup in consume_updates {
        let pair = find_player_and_ship_mut(&mut state, pup.0);
        let picked_items = InventoryItem::from(pup.1);
        if let Some(ship) = pair.1 {
            // TODO add a pickup effect
            add_items(&mut ship.inventory, picked_items);
        }
    }
}

const MAX_NAT_SPAWN_MINERALS: u32 = 10;

fn update_state_minerals(
    existing: &Vec<NatSpawnMineral>,
    belts: &Vec<AsteroidBelt>,
    prng: &mut Pcg64Mcg,
) -> Vec<NatSpawnMineral> {
    let mut res = existing.clone();
    if belts.len() > 0 {
        loop {
            if res.len() as u32 >= MAX_NAT_SPAWN_MINERALS {
                break;
            }
            res.push(seed_mineral(belts, prng));
        }
    }
    res
}

pub fn spawn_mineral(location: &mut Location, rarity: Rarity, pos: Vec2f64, prng: &mut Pcg64Mcg) {
    let mut min = gen_mineral(prng, pos);
    min.rarity = rarity;
    location.minerals.push(min)
}

pub fn spawn_asteroid(location: &mut Location, pos: Vec2f64, radius: f64, prng: &mut Pcg64Mcg) {
    let mut asteroid = gen_asteroid(prng, pos);
    asteroid.spatial.radius = radius;
    location.asteroids.push(asteroid)
}

pub fn spawn_container(loc: &mut Location, at: Vec2f64) {
    let mut prng = get_prng();
    let mut container = Container::random(&mut prng);
    container.position = at;
    loc.containers.push(container);
}

fn seed_mineral(belts: &Vec<AsteroidBelt>, prng: &mut Pcg64Mcg) -> NatSpawnMineral {
    let picked = prng.gen_range(0, belts.len());
    let belt = &belts[picked];
    let mut pos_in_belt = gen_pos_in_belt(belt, prng);
    pos_in_belt.reduce_precision();
    gen_mineral(prng, pos_in_belt)
}

fn gen_mineral(prng: &mut Pcg64Mcg, pos: Vec2f64) -> NatSpawnMineral {
    let mineral_props = gen_mineral_props(prng);
    NatSpawnMineral {
        x: pos.x,
        y: pos.y,
        id: prng_id(prng),
        radius: mineral_props.0,
        value: mineral_props.1,
        rarity: mineral_props.3,
        color: mineral_props.2,
    }
}

fn gen_asteroid(prng: &mut Pcg64Mcg, pos: Vec2f64) -> Asteroid {
    Asteroid {
        id: prng_id(prng),
        spatial: SpatialProps {
            position: pos,
            velocity: Vec2f64::zero(),
            angular_velocity: 0.0,
            rotation_rad: 0.0,
            radius: 1.0,
        },
        movement: Movement::None,
        health: Health::new(50.0),
        rot_movement: RotationMovement::None,
        to_clean: false,
    }
}

fn gen_pos_in_belt(belt: &AsteroidBelt, prng: &mut Pcg64Mcg) -> Vec2f64 {
    let range = prng.gen_range(
        belt.spatial.radius - belt.width / 2.0,
        belt.spatial.radius + belt.width / 2.0,
    );
    let angle_rad = prng.gen_range(0.0, PI * 2.0);
    let x = angle_rad.cos() * range;
    let y = angle_rad.sin() * range;
    Vec2f64 { x, y }
}

fn update_ships_respawn(state: &mut GameState, prng: &mut Pcg64Mcg) {
    let mut to_spawn = vec![];
    for player in state.players.iter() {
        if player.ship_id.is_none() {
            if player.long_actions.len() > 5 {
                eprintln!("too long long actions {}", player.long_actions.len());
            }
            let respawns_in_progress = player
                .long_actions
                .iter()
                .any(|a| matches!(a, LongActionPlayer::Respawn { .. }));

            if !respawns_in_progress {
                to_spawn.push(player.id);
            }
        }
    }

    for player_id in to_spawn {
        try_start_long_action_player_owned(state, player_id, LongActionStart::Respawn, prng);
    }
}

pub const PLAYER_RESPAWN_TIME_MC: i32 = 10 * 1000 * 1000;
pub const PLANET_HEALTH_REGEN_PER_TICK: f64 = 1.0 / 1000.0 / 1000.0;

fn apply_players_ship_death(ship: Ship, player: Option<&mut Player>, state_id: Uuid) {
    match player {
        None => {}
        Some(player) => {
            fire_event(GameEvent::ShipDied {
                state_id,
                ship: ship.clone(),
                player_id: Some(player.id),
            });
        }
    }
}

pub fn add_player(
    state: &mut GameState,
    player_id: Uuid,
    is_bot: bool,
    name: Option<String>,
    prng: &mut Pcg64Mcg,
) {
    let mut player = Player::new(player_id, &state.mode, prng);
    player.is_bot = is_bot;
    player.name = name.unwrap_or(player_id.to_string());
    state.players.push(player);
}

pub struct ShipTemplate {
    at: Option<Vec2f64>,
    npc_traits: Option<Vec<AiTrait>>,
    abilities: Option<Vec<Ability>>,
    name: Option<String>,
    health: Option<Health>,
    movement: Option<Movement>,
    properties: Option<Vec<ObjectProperty>>,
}
impl ShipTemplate {
    pub fn defaul_ship_movement() -> Movement {
        let max_linear_speed = 20.0 / 1000.0 / 1000.0;
        let max_angular_speed = PI / 1000.0 / 1000.0;
        Movement::ShipAccelerated {
            max_linear_speed,
            max_rotation_speed: max_angular_speed,
            linear_drag: max_linear_speed * 0.025 / 1e6, // 2.5% per second
            acc_linear: max_linear_speed * 0.25 / 1e6,   // 25% per second
            brake_acc: max_linear_speed * 0.5 / 1e6,     // 50% per second
            max_turn_speed: max_angular_speed,
            acc_angular: max_angular_speed / 6.0 / 1e5,
        }
    }
    pub fn pirate(at: Option<Vec2f64>) -> ShipTemplate {
        let max_linear_speed = 20.0 / 1000.0 / 1000.0;
        let max_angular_speed = PI / 2.0 / 1000.0 / 1000.0;
        ShipTemplate {
            at,
            npc_traits: Some(vec![AiTrait::ImmediatePlanetLand]),
            abilities: Some(vec![Ability::BlowUpOnLand]),
            name: Some("Pirate".to_string()),
            health: Some(Health::new(40.0)),
            movement: Some(ShipTemplate::defaul_ship_movement()),
            properties: Some(vec![
                ObjectProperty::MoneyOnKill(MoneyOnKillProps { amount: 100 }),
                ObjectProperty::PirateShip,
            ]),
        }
    }

    pub fn player(at: Option<Vec2f64>) -> ShipTemplate {
        let max_linear_speed = 20.0 / 1000.0 / 1000.0;
        let max_angular_speed = PI / 1000.0 / 1000.0;
        let legacy_movement = Movement::ShipMonotonous {
            move_speed: max_linear_speed,
            turn_speed: max_angular_speed,
        };
        ShipTemplate {
            at,
            npc_traits: None,
            abilities: Some(vec![Ability::ToggleMovement {
                movements: vec![
                    ShipTemplate::defaul_ship_movement(),
                    legacy_movement.clone(),
                ],
                current_idx: 0,
            }]),
            name: None,
            health: Some(Health::new_regen(
                100.0,
                SHIP_REGEN_PER_SEC / 1000.0 / 1000.0,
            )),
            movement: Some(ShipTemplate::defaul_ship_movement()),
            properties: None,
        }
    }
}

pub fn spawn_ship<'a>(
    state: &'a mut GameState,
    player_id: Option<Uuid>,
    template: ShipTemplate,
    prng: &mut Pcg64Mcg,
) -> &'a Ship {
    let rand_planet = get_random_planet(&state.locations[0].planets, None, prng);
    let mut at = template.at;
    if rand_planet.is_some() && at.is_none() {
        let p = rand_planet.unwrap();
        at = Some(p.spatial.position.clone());
    }
    let mut ship = Ship::new(prng, &mut at);
    template
        .abilities
        .map(|abilities| ship.abilities.extend(abilities));
    ship.npc = if template.npc_traits.is_some() {
        Some(new_bot(template.npc_traits, prng_id(prng)))
    } else {
        None
    };
    ship.name = template.name;
    ship.properties = template.properties.unwrap_or(Default::default());
    template.movement.map(|m| ship.movement_definition = m);
    template.health.map(|health| ship.health = health);
    let state_id = state.id;

    let event = match player_id {
        None => Some(GameEvent::ShipSpawned {
            state_id: state.id,
            ship: ship.clone(),
            player_id: None,
        }),
        Some(player_id) => state
            .players
            .iter_mut()
            .find(|p| p.id == player_id)
            .map(|p| {
                p.ship_id = Some(ship.id);
                GameEvent::ShipSpawned {
                    state_id,
                    ship: ship.clone(),
                    player_id: Some(p.id),
                }
            }),
    };
    if let Some(event) = event {
        world_events::fire_saved_event(state, event);
    }
    state.locations[0].ships.push(ship);
    &state.locations[0].ships[state.locations[0].ships.len() - 1]
}

#[derive(Clone)]
pub struct ShipIdx {
    pub location_idx: usize,
    pub ship_idx: usize,
}

#[derive(Serialize, Deserialize, PartialEq, Eq, Hash, Clone, Debug)]
pub enum TimeMarks {
    PirateSpawn,
    BotAction,
    UpdateShipHistory,
}

pub fn every(interval_ticks: u32, current_ticks: u32, last_trigger: Option<u32>) -> bool {
    return every_diff(interval_ticks, current_ticks, last_trigger).is_some();
}

pub fn every_diff(
    interval_ticks: u32,
    current_ticks: u32,
    last_trigger: Option<u32>,
) -> Option<u32> {
    let last_trigger = last_trigger.unwrap_or(0);
    let diff = (current_ticks as i64 - last_trigger as i64).max(0) as u32;
    let trigger = diff > interval_ticks;
    return if trigger { Some(diff) } else { None };
}

pub fn update_rule_specifics(
    state: &mut GameState,
    prng: &mut Pcg64Mcg,
    sampler: &mut Sampler,
    client: bool,
) {
    let sampler_mark_type = match state.mode {
        GameMode::Unknown => None,
        GameMode::CargoRush => Some(SamplerMarks::ModeCargoRush as u32),
        GameMode::Tutorial => None,
        GameMode::Sandbox => None,
        GameMode::PirateDefence => Some(SamplerMarks::ModePirateDefence as u32),
    };
    let mark_id = sampler_mark_type.map(|sampler_mark_type| sampler.start(sampler_mark_type));
    match state.mode {
        GameMode::Unknown => {}
        GameMode::CargoRush => {
            let quests_id = sampler.start(SamplerMarks::ModeCargoRushQuests as u32);
            if !client {
                cargo_rush::update_quests(state, prng);
            }
            sampler.end(quests_id);
        }
        GameMode::Tutorial => {}
        GameMode::Sandbox => {}
        GameMode::PirateDefence => {
            pirate_defence::update_state_pirate_defence(state, prng);
        }
    }
    mark_id.map(|mark_id| sampler.end(mark_id));
}

pub fn remove_player_from_state(conn_id: Uuid, state: &mut GameState) {
    // intentionally drop the extracted result
    indexing::find_and_extract_ship(state, conn_id);
    state.players.iter().position(|p| p.id == conn_id).map(|i| {
        state.players.remove(i);
    });
}

pub fn try_replace_ship(state: &mut GameState, updated_ship: &Ship, player_id: Uuid) -> bool {
    let old_ship_index = find_player_ship_index(&state, player_id);
    return if let Some(old_ship_index) = old_ship_index {
        state.locations[old_ship_index.location_idx]
            .ships
            .remove(old_ship_index.ship_idx);
        state.locations[old_ship_index.location_idx]
            .ships
            .push(updated_ship.clone());
        true
    } else {
        eprintln!("couldn't replace ship");
        false
    };
}

pub fn try_replace_ship_npc(
    state: &mut GameState,
    updated_ship: &Ship,
    old_ship_index: Option<ShipIdx>,
) -> bool {
    return if let Some(old_ship_index) = old_ship_index {
        state.locations[old_ship_index.location_idx]
            .ships
            .remove(old_ship_index.ship_idx);
        state.locations[old_ship_index.location_idx]
            .ships
            .push(updated_ship.clone());
        true
    } else {
        eprintln!("couldn't replace ship");
        false
    };
}

pub fn remove_object(state: &mut GameState, loc_idx: usize, remove: ObjectSpecifier) {
    match remove {
        ObjectSpecifier::Unknown => {}
        ObjectSpecifier::Mineral { id } => state.locations[loc_idx].minerals.retain(|m| m.id != id),
        ObjectSpecifier::Container { id } => {
            state.locations[loc_idx].containers.retain(|m| m.id != id)
        }
        ObjectSpecifier::Ship { id } => state.locations[loc_idx].ships.retain(|m| m.id != id),
        ObjectSpecifier::Planet { id } => state.locations[loc_idx].planets.retain(|m| m.id != id),
        ObjectSpecifier::Star { .. } => {
            state.locations[loc_idx].star = None;
        }
        ObjectSpecifier::Asteroid { id } => {
            state.locations[loc_idx].asteroids.retain(|m| m.id != id)
        }
        ObjectSpecifier::AsteroidBelt { id } => state.locations[loc_idx]
            .asteroid_belts
            .retain(|m| m.id != id),
        ObjectSpecifier::Wreck { id } => state.locations[loc_idx].wrecks.retain(|w| w.id != id),
        ObjectSpecifier::Location { id } => state.locations.retain(|l| l.id != id),
        ObjectSpecifier::Projectile { id } => state.locations[loc_idx]
            .projectiles
            .retain(|p| p.get_id() != id),
        ObjectSpecifier::Explosion { id } => {
            state.locations[loc_idx].explosions.retain(|e| e.id != id)
        }
    }
}

pub fn make_room(
    mode: &GameMode,
    room_id: Uuid,
    prng: &mut Pcg64Mcg,
    bots_seed: Option<String>,
    opts: Option<GenStateOpts>,
    external_caches: Option<&mut GameStateCaches>,
) -> (Uuid, Room) {
    let room_name = format!("{} - {}", mode, room_id);
    let mut new_caches = GameStateCaches::new();
    let use_external_caches = external_caches.is_some();
    let caches = external_caches.unwrap_or(&mut new_caches);
    let state = seed_state(
        &mode,
        random_stuff::random_hex_seed_seeded(prng),
        opts,
        caches,
    );
    let state_id = state.id.clone();
    let mut room = Room {
        id: room_id,
        name: room_name,
        state: state.clone(),
        last_players_mark: None,
        bots: vec![],
        bots_seed,
        next_seed: None,
        caches: if use_external_caches {
            GameStateCaches::new()
        } else {
            new_caches
        },
    };
    match mode {
        GameMode::Unknown => {}
        GameMode::CargoRush => {
            cargo_rush::on_create_room(&mut room, prng);
        }
        GameMode::Tutorial => {}
        GameMode::Sandbox => {}
        GameMode::PirateDefence => {
            pirate_defence::on_create_room(&mut room, prng);
        }
    }
    (state_id, room)
}

pub fn update_room(
    mut prng: &mut Pcg64Mcg,
    mut sampler: Sampler,
    elapsed_micro: i64,
    room: &mut Room,
    d_table: &DialogueTable,
    external_caches: Option<&mut GameStateCaches>,
) -> (SpatialIndexes, Sampler) {
    let caches_mark = sampler.start(SamplerMarks::UpdateCacheClone as u32);
    let caches = if let Some(external_caches) = external_caches {
        external_caches
    } else {
        &mut room.caches
    };
    sampler.end(caches_mark);
    let (new_state, mut sampler, spatial_indexes) = update_world(
        room.state.clone(),
        elapsed_micro,
        false,
        sampler,
        UpdateOptions {
            limit_area: AABB::maxed(),
            force_non_determinism: None,
        },
        &mut prng,
        &d_table,
        caches,
    );
    let update_room_caches_mark = sampler.start(SamplerMarks::UpdateRoomCaches as u32);
    // if let Some(external_cache) = external_caches {
    //     *external_cache = *caches;
    // }
    room.state = new_state;
    sampler.end(update_room_caches_mark);

    // by default, bot behavior is non-deterministic, unless we explicitly requested it in room setup
    let mut bot_prng = room.bots_seed.clone().map_or(get_prng(), |s| seed_prng(s));

    if let Some(bot_action_elapsed) = every_diff(
        BOT_ACTION_TIME_TICKS as u32,
        room.state.ticks as u32,
        room.state
            .interval_data
            .as_ref()
            .and_then(|id| id.get(&TimeMarks::BotAction))
            .map(|m| *m),
    ) {
        let state_ticks = room.state.ticks as u32;
        room.state
            .interval_data
            .as_mut()
            .map(|idata| idata.insert(TimeMarks::BotAction, state_ticks));

        let bots_mark = sampler.start(SamplerMarks::UpdateBots as u32);
        let bot_players_mark = sampler.start(SamplerMarks::UpdateBotsPlayers as u32);
        do_bot_players_actions(
            room,
            &d_table,
            bot_action_elapsed as i64,
            &spatial_indexes,
            &mut bot_prng,
        );
        sampler.end(bot_players_mark);
        let npcs_mark = sampler.start(SamplerMarks::UpdateBotsNPCs as u32);
        do_bot_npcs_actions(
            room,
            bot_action_elapsed as i64,
            &spatial_indexes,
            &mut bot_prng,
        );
        sampler.end(npcs_mark);
        sampler.end(bots_mark);
    }

    (spatial_indexes, sampler)
}
