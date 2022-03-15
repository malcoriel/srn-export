use std::borrow::{Borrow, BorrowMut};
use std::collections::{HashMap, HashSet, VecDeque};
use std::f64::consts::PI;
#[allow(deprecated)]
use std::f64::{INFINITY, NEG_INFINITY};
use std::fmt::{Display, Formatter};
use std::iter::FromIterator;

use chrono::Utc;
use itertools::{Either, Itertools};
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

use crate::abilities::{Ability, SHOOT_COOLDOWN_TICKS};
use crate::api_struct::{new_bot, AiTrait, Bot, Room, RoomId};
use crate::autofocus::{build_spatial_index, SpatialIndex};
use crate::bots::{do_bot_npcs_actions, do_bot_players_actions};
use crate::cargo_rush::{CargoDeliveryQuestState, Quest};
use crate::combat::{Health, ShootTarget};
use crate::indexing::{
    find_my_player, find_my_ship, find_my_ship_index, find_planet, find_player_and_ship_mut,
    index_planets_by_id, index_players_by_ship_id, index_ships_by_id, index_state, ObjectSpecifier,
};
use crate::inventory::{
    add_item, add_items, has_quest_item, shake_items, InventoryItem, InventoryItemType,
};
use crate::long_actions::{
    cancel_all_long_actions_of_type, finish_long_act, finish_long_act_player, tick_long_act,
    tick_long_act_player, try_start_long_action, try_start_long_action_ship, LongAction,
    LongActionPlayer, LongActionStart, MIN_SHIP_DOCKING_RADIUS, SHIP_DOCKING_RADIUS_COEFF,
};
use crate::market::{init_all_planets_market, Market};
use crate::notifications::{get_new_player_notifications, Notification, NotificationText};
use crate::perf::{Sampler, SamplerMarks};
use crate::planet_movement::{
    build_anchors_from_bodies, index_bodies_by_id, make_bodies_from_planets, IBody,
};
use crate::random_stuff::{
    gen_asteroid_radius, gen_asteroid_shift, gen_color, gen_mineral_props, gen_planet_count,
    gen_planet_gap, gen_planet_name, gen_planet_orbit_speed, gen_planet_radius,
    gen_random_photo_id, gen_sat_count, gen_sat_gap, gen_sat_name, gen_sat_orbit_speed,
    gen_sat_radius, gen_star_name, gen_star_radius,
};
use crate::ship_action::{PlayerActionRust, ShipMovementMarkers};
use crate::substitutions::substitute_notification_texts;
use crate::system_gen::{seed_state, str_to_hash, DEFAULT_WORLD_UPDATE_EVERY_TICKS};
use crate::tractoring::{
    ContainersContainer, IMovable, MineralsContainer, MovablesContainer, MovablesContainerBase,
};
use crate::vec2::{deg_to_rad, AsVec2f64, Precision, Vec2f64};
use crate::world_events::{world_update_handle_event, GameEvent, ProcessedGameEvent};
use crate::world_player_actions::world_update_handle_player_action;
use crate::{
    abilities, autofocus, cargo_rush, indexing, pirate_defence, prng_id, random_stuff, system_gen,
    world_events,
};
use crate::{combat, fire_event, market, notifications, planet_movement, ship_action, tractoring};
use crate::{dialogue, vec2};
use crate::{get_prng, new_id, DEBUG_PHYSICS};
use crate::{seed_prng, DialogueTable};
use dialogue::DialogueStates;

const SHIP_TURN_SPEED_DEG: f64 = 90.0;
const ORB_SPEED_MULT: f64 = 1.0;
const TRAJECTORY_STEP_MICRO: i64 = 250 * 1000;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;
const ASTEROID_COUNT: u32 = 200;
const ASTEROID_BELT_RANGE: f64 = 100.0;

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

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ManualMoveUpdate {
    pub position: Vec2f64,
    pub rotation: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum LocalEffect {
    Unknown {},
    DmgDone {
        hp: i32,
        id: Uuid,
        tick: u32,
        ship_id: Uuid,
    },
    Heal {
        hp: i32,
        id: Uuid,
        tick: u32,
        ship_id: Uuid,
    },
    PickUp {
        id: Uuid,
        text: String,
        position: Vec2f64,
        tick: u32,
    },
}

pub fn get_random_planet<'a>(
    planets: &'a Vec<Planet>,
    docked_at: Option<Uuid>,
    rng: &mut SmallRng,
) -> Option<&'a Planet> {
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

#[derive(
    Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, PartialEq, Eq, Hash,
)]
#[serde(tag = "tag")]
pub enum ObjectProperty {
    Unknown,
    UnlandablePlanet,
    PirateDefencePlayersHomePlanet,
    PirateShip,
    MoneyOnKill { amount: i32 },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Planet {
    pub id: Uuid,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
    pub orbit_speed: f64,
    pub anchor_id: Uuid,
    pub anchor_tier: u32,
    pub color: String,
    pub health: Option<Health>,
    pub properties: Vec<ObjectProperty>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
// derive Serialize-Deserialize will add constraints itself, no need to explicitly mark them
pub struct SpatialProps {
    pub position: Vec2f64,
    pub rotation_rad: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct PlanetV2 {
    pub id: Uuid,
    pub name: String,
    pub spatial: SpatialProps,
    pub movement: Movement,
    pub color: String,
    pub health: Option<Health>,
    pub properties: Vec<ObjectProperty>,
}

impl PlanetV2 {
    pub fn get_anchor_ref<'a>(&self, loc: &'a Location) -> Box<&'a dyn IBody> {
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

    pub fn from(p: &Planet, loc: &Location) -> Self {
        let pos = Vec2f64 { x: p.x, y: p.y };
        let speed_ticks_rad = p.orbit_speed / 1000.0 / 1000.0;
        let full_period_ticks = (std::f64::consts::PI * 2.0 / speed_ticks_rad).floor();

        let (anchor, radius_to_anchor, relative_position) = match p.anchor_tier {
            1 => {
                // planet
                let star = loc.star.clone().expect(
                    format!(
                        "No star found for anchor tier {} of planet {}",
                        p.anchor_tier, p.id
                    )
                    .as_str(),
                );
                (
                    ObjectSpecifier::Star { id: star.id },
                    pos.euclidean_distance(&star.as_vec()),
                    pos.subtract(&star.as_vec()),
                )
            }
            2 => {
                let parent_planet = loc.planets.iter().find(|par| par.id == p.anchor_id).expect(
                    format!(
                        "No anchor planet found by id {} for planet {}",
                        p.anchor_id, p.id
                    )
                    .as_str(),
                );
                let parent_pos = AsVec2f64::as_vec(parent_planet);
                (
                    ObjectSpecifier::Planet {
                        id: parent_planet.id,
                    },
                    pos.euclidean_distance(&parent_pos),
                    pos.subtract(&parent_pos),
                )
            }
            _ => panic!("Unsupported anchor tier {}", p.anchor_tier),
        };
        Self {
            id: p.id.clone(),
            name: p.name.clone(),
            spatial: SpatialProps {
                position: pos,
                rotation_rad: p.rotation,
                radius: p.radius,
            },
            movement: Movement::RadialMonotonous {
                full_period_ticks: full_period_ticks.abs(),
                clockwise: full_period_ticks < 0.0,
                radius_to_anchor,
                anchor,
                relative_position,
                interpolation_hint: None,
            },
            color: p.color.clone(),
            health: p.health.clone(),
            properties: p.properties.clone(),
        }
    }
}

impl Planet {
    pub fn new() -> Self {
        Self {
            id: Default::default(),
            name: "".to_string(),
            x: 0.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.0,
            anchor_id: Default::default(),
            anchor_tier: 1,
            color: "".to_string(),
            health: None,
            properties: Default::default(),
        }
    }

    pub fn get_position(&self) -> Vec2f64 {
        return Vec2f64 {
            x: self.x,
            y: self.y,
        };
    }

    pub fn from_pv2(f: &PlanetV2, star_id: Uuid) -> Self {
        let (orbit_speed, anchor_id, anchor_tier) = match &f.movement {
            Movement::RadialMonotonous {
                full_period_ticks,
                anchor,
                ..
            } => {
                let anchor_id = anchor.get_id().unwrap();
                (
                    std::f64::consts::PI * 2.0 / full_period_ticks,
                    anchor_id,
                    if anchor_id == star_id { 1 } else { 2 },
                )
            }
            _ => panic!("Unsupported movement {:?}", f.movement),
        };
        Self {
            id: f.id,
            name: f.name.clone(),
            x: f.spatial.position.x,
            y: f.spatial.position.y,
            rotation: f.spatial.rotation_rad,
            radius: f.spatial.radius,
            orbit_speed,
            anchor_id,
            anchor_tier,
            color: f.color.clone(),
            health: f.health.clone(),
            properties: f.properties.clone(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Asteroid {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
    pub orbit_speed: f64,
    pub anchor_id: Uuid,
    pub anchor_tier: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct AsteroidBelt {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
    pub width: f64,
    pub count: u32,
    pub orbit_speed: f64,
    pub anchor_id: Uuid,
    pub anchor_tier: u32,
    pub scale_mod: f64,
}

impl AsVec2f64 for Planet {
    fn as_vec(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Star {
    pub id: Uuid,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    pub rotation: f64,
    pub color: String,
    pub corona_color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub struct ProcessedPlayerAction {
    pub action: PlayerActionRust,
    pub processed_at_ticks: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ShipTurret {
    id: Uuid,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Ship {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub acc_periodic_dmg: f64,
    pub acc_periodic_heal: f64,
    pub rotation: f64,
    pub radius: f64,
    pub color: String,
    pub docked_at: Option<Uuid>,
    pub tractor_target: Option<Uuid>,
    pub navigate_target: Option<Vec2f64>,
    pub dock_target: Option<Uuid>,
    pub trajectory: Vec<Vec2f64>,
    pub inventory: Vec<InventoryItem>,
    pub abilities: Vec<Ability>,
    pub auto_focus: Option<ObjectSpecifier>,
    pub hostile_auto_focus: Option<ObjectSpecifier>,
    pub movement_markers: ShipMovementMarkers,
    pub movement_definition: Movement,
    pub health: Health,
    pub local_effects: Vec<LocalEffect>,
    pub long_actions: Vec<LongAction>,
    pub npc: Option<Bot>,
    pub name: Option<String>,
    pub turrets: Vec<ShipTurret>,
    pub properties: Vec<ObjectProperty>,
}

pub fn gen_turrets(count: usize, prng: &mut SmallRng) -> Vec<(Ability, ShipTurret)> {
    let mut res = vec![];
    for _i in 0..count {
        let id = prng_id(prng);
        res.push((
            Ability::Shoot {
                cooldown_ticks_remaining: 0,
                turret_id: id,
                cooldown_normalized: 0.0,
                cooldown_ticks_max: SHOOT_COOLDOWN_TICKS,
            },
            ShipTurret { id },
        ))
    }
    res
}

impl Ship {
    pub fn new(prng: &mut SmallRng, at: &mut Option<Vec2f64>) -> Ship {
        let turrets = gen_turrets(2, prng);
        Ship {
            id: prng_id(prng),
            color: gen_color(prng).to_string(),
            x: if at.is_some() { at.unwrap().x } else { 100.0 },
            y: if at.is_some() { at.unwrap().y } else { 100.0 },
            acc_periodic_dmg: 0.0,
            acc_periodic_heal: 0.0,
            rotation: 0.0,
            radius: 2.0,
            docked_at: None,
            tractor_target: None,
            navigate_target: None,
            dock_target: None,
            trajectory: vec![],
            inventory: vec![],
            abilities: turrets.iter().map(|(a, _t)| a.clone()).collect(),
            turrets: turrets.iter().map(|(_a, t)| t.clone()).collect(),
            auto_focus: None,
            hostile_auto_focus: None,
            movement_markers: Default::default(),
            movement_definition: Movement::Unknown,
            health: Health::new(100.0),
            local_effects: vec![],
            long_actions: vec![],
            npc: None,
            name: None,
            properties: Default::default(),
        }
    }
}

impl Ship {
    pub fn set_from(&mut self, pos: &Vec2f64) {
        self.x = pos.x;
        self.y = pos.y;
    }
    pub fn get_position(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }
}

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
    pub fn new(id: Uuid, mode: &GameMode, prng: &mut SmallRng) -> Self {
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
    pub rating: Vec<(Player, u32)>,
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

    pub fn random(prng: &mut SmallRng) -> Self {
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

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Wreck {
    pub position: Vec2f64,
    pub id: Uuid,
    pub rotation: f64,
    pub radius: f64,
    pub color: String,
    pub decay_normalized: f64,
    pub decay_ticks: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Location {
    pub seed: String,
    pub id: Uuid,
    pub star: Option<Star>,
    pub planets: Vec<Planet>,
    pub asteroids: Vec<Asteroid>,
    pub wrecks: Vec<Wreck>,
    pub minerals: Vec<NatSpawnMineral>,
    pub containers: Vec<Container>,
    pub position: Vec2f64,
    pub asteroid_belts: Vec<AsteroidBelt>,
    pub ships: Vec<Ship>,
    pub adjacent_location_ids: Vec<Uuid>,
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
pub struct GameState {
    pub id: Uuid,
    pub version: u32,
    pub mode: GameMode,
    pub tag: Option<String>,
    pub seed: String,
    pub my_id: Uuid,
    pub start_time_ticks: u64,
    pub players: Vec<Player>,
    pub milliseconds_remaining: i32,
    pub paused: bool,
    pub leaderboard: Option<Leaderboard>,
    pub millis: u32,
    pub ticks: u64,
    pub disable_hp_effects: bool,
    pub market: Market,
    pub locations: Vec<Location>,
    pub interval_data: HashMap<TimeMarks, u32>,
    pub game_over: Option<GameOver>,
    pub events: VecDeque<GameEvent>,
    pub player_actions: VecDeque<PlayerActionRust>,
    pub processed_events: Vec<ProcessedGameEvent>,
    pub processed_player_actions: Vec<ProcessedPlayerAction>,
    pub update_every_ticks: u64,
    pub accumulated_not_updated_ticks: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct GameOver {
    pub reason: String,
}

pub const GAME_STATE_VERSION: u32 = 3;

impl GameState {
    pub fn new() -> Self {
        Self {
            id: Default::default(),
            version: GAME_STATE_VERSION,
            mode: GameMode::Unknown,
            tag: None,
            seed: "".to_string(),
            my_id: Default::default(),
            start_time_ticks: 0,
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            millis: 0,
            ticks: 0,
            disable_hp_effects: false,
            market: Market {
                wares: Default::default(),
                prices: Default::default(),
                time_before_next_shake: 0,
            },
            locations: vec![],
            interval_data: Default::default(),
            game_over: None,

            events: Default::default(),
            player_actions: Default::default(),
            processed_events: vec![],
            processed_player_actions: vec![],
            update_every_ticks: DEFAULT_WORLD_UPDATE_EVERY_TICKS,
            accumulated_not_updated_ticks: 0,
        }
    }
}

fn seed_asteroids(star: &Star, rng: &mut SmallRng) -> Vec<Asteroid> {
    let mut res = vec![];
    let mut cur_angle: f64 = 0.0;
    let angle_step = PI * 2.0 / ASTEROID_COUNT as f64;
    for _i in 0..ASTEROID_COUNT {
        let x: f64 = cur_angle.cos() * ASTEROID_BELT_RANGE;
        let y: f64 = cur_angle.sin() * ASTEROID_BELT_RANGE;
        let shift = gen_asteroid_shift(rng);
        res.push(Asteroid {
            id: prng_id(rng),
            x: x + shift.0,
            y: y + shift.1,
            rotation: 0.0,
            radius: gen_asteroid_radius(rng),
            orbit_speed: 0.05,
            anchor_id: star.id,
            anchor_tier: 1,
        });
        cur_angle += angle_step;
    }
    res
}

pub fn force_update_to_now(state: &mut GameState) {
    let now = Utc::now().timestamp_millis() as u64;
    state.millis = (now - state.start_time_ticks) as u32;
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
    pub fn contains_body(&self, body: &Box<dyn IBody>) -> bool {
        let x = body.get_x();
        let y = body.get_y();
        return self.top_left.x <= x
            && x <= self.bottom_right.x
            && self.top_left.y <= y
            && y <= self.bottom_right.y;
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
    pub disable_hp_effects: bool,
    pub limit_area: AABB,
}

impl UpdateOptions {
    pub fn new() -> Self {
        Self {
            disable_hp_effects: false,
            limit_area: AABB::maxed(),
        }
    }
}

// first group is in area, second is not
pub fn split_bodies_by_area(
    bodies: Vec<Box<dyn IBody>>,
    area: AABB,
) -> (Vec<Box<dyn IBody>>, Vec<Box<dyn IBody>>) {
    let anchors = build_anchors_from_bodies(bodies.clone());

    let res: (Vec<_>, Vec<_>) = bodies.into_iter().partition_map(|b| {
        if area.contains_body(&b) {
            Either::Left(b)
        } else {
            Either::Right(b)
        }
    });

    let (mut picked, mut dropped) = res;
    let mut already_picked_ids: HashSet<Uuid> =
        HashSet::from_iter(picked.iter().map(|p| p.get_id()));
    let anchors_vec = picked
        .iter()
        .filter_map(|p| {
            anchors.get(&p.get_anchor_id()).and_then(|p| {
                if !already_picked_ids.contains(&p.get_id()) {
                    already_picked_ids.insert(p.get_id());
                    Some(p.clone())
                } else {
                    None
                }
            })
        })
        .collect::<Vec<_>>();
    let anchor_ids: HashSet<Uuid> = HashSet::from_iter(anchors_vec.iter().map(|a| a.get_id()));
    picked.append(&mut anchors_vec.clone());
    dropped = dropped
        .into_iter()
        .filter(|p| !anchor_ids.contains(&p.get_id()))
        .collect::<Vec<_>>();
    return (picked, dropped);
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
    sampler: Sampler,
    update_options: UpdateOptions,
    spatial_indexes: &mut SpatialIndexes,
    prng: &mut SmallRng,
    d_states: &mut DialogueStates,
    d_table: &DialogueTable,
) -> (GameState, Sampler) {
    let mut remaining = elapsed + state.accumulated_not_updated_ticks as i64;
    let update_interval = state.update_every_ticks as i64;
    let (mut curr_state, mut curr_sampler) = (state, sampler);
    while remaining > update_interval {
        let pair = update_world_iter(
            curr_state,
            update_interval,
            client,
            curr_sampler,
            update_options.clone(),
            spatial_indexes,
            prng,
            d_states,
            d_table,
        );
        remaining -= update_interval;
        curr_state = pair.0;
        curr_sampler = pair.1;
    }
    curr_state.accumulated_not_updated_ticks = remaining as u32;
    (curr_state, curr_sampler)
}

fn update_world_iter(
    mut state: GameState,
    elapsed: i64,
    client: bool,
    sampler: Sampler,
    update_options: UpdateOptions,
    spatial_indexes: &mut SpatialIndexes,
    prng: &mut SmallRng,
    d_states: &mut DialogueStates,
    d_table: &DialogueTable,
) -> (GameState, Sampler) {
    state.millis += elapsed as u32 / 1000;
    state.ticks += elapsed as u64;
    if state.mode != GameMode::Tutorial {
        state.milliseconds_remaining -= elapsed as i32 / 1000;
    }

    let mut sampler = sampler;

    let events_id = sampler.start(SamplerMarks::UpdateEvents as u32);
    update_events(&mut state, prng, client, d_states, d_table);
    sampler.end(events_id);

    let player_actions_id = sampler.start(SamplerMarks::UpdatePlayerActions as u32);
    update_player_actions(&mut state, prng);
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
                state = seed_state(&state.mode, random_stuff::random_hex_seed());
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

            if state.market.time_before_next_shake > 0 {
                state.market.time_before_next_shake -= elapsed;
            } else {
                let market_update_start = sampler.start(SamplerMarks::UpdateMarket as u32);
                let mut wares = state.market.wares.clone();
                let mut prices = state.market.prices.clone();
                let planets = state.locations[0]
                    .planets
                    .iter()
                    .map(|p| p.clone())
                    .collect::<Vec<_>>();
                market::shake_market(planets, &mut wares, &mut prices, prng);
                state.market = Market {
                    wares,
                    prices,
                    time_before_next_shake: market::SHAKE_MARKET_EVERY_TICKS,
                };
                sampler.end(market_update_start);
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
                log!("Game ended due to time limit");
            } else if game_over_end {
                log!("Game ended due to game over trigger");
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
            for location_idx in 0..max_loc {
                sampler = update_location(
                    &mut state,
                    elapsed,
                    client,
                    &update_options,
                    sampler,
                    location_idx,
                    spatial_indexes,
                    prng,
                )
            }
        };
    };
    (state, sampler)
}

fn update_player_actions(state: &mut GameState, prng: &mut SmallRng) {
    let mut actions_to_process = vec![];
    while let Some(event) = state.player_actions.pop_front() {
        actions_to_process.push(event);
    }
    let mut processed_actions = vec![];
    for action in actions_to_process.into_iter() {
        world_update_handle_player_action(state, action.clone(), prng);
        let processed_action = ProcessedPlayerAction {
            action,
            processed_at_ticks: state.ticks,
        };
        processed_actions.push(processed_action);
    }
    state
        .processed_player_actions
        .append(&mut processed_actions);
}

fn update_events(
    state: &mut GameState,
    prng: &mut SmallRng,
    client: bool,
    d_states: &mut DialogueStates,
    d_table: &DialogueTable,
) {
    if client {
        return;
    }
    let mut events_to_process = vec![];
    while let Some(event) = state.events.pop_front() {
        events_to_process.push(event);
    }
    let mut processed_events = vec![];
    for event in events_to_process.into_iter() {
        world_update_handle_event(state, prng, event.clone(), d_states, d_table);
        let processed_event = ProcessedGameEvent {
            event,
            processed_at_ticks: state.ticks,
        };
        processed_events.push(processed_event);
    }
    state.processed_events.append(&mut processed_events);
}

pub fn update_location(
    mut state: &mut GameState,
    elapsed: i64,
    client: bool,
    update_options: &UpdateOptions,
    mut sampler: Sampler,
    location_idx: usize,
    spatial_indexes: &mut SpatialIndexes,
    prng: &mut SmallRng,
) -> Sampler {
    let spatial_index_id = sampler.start(SamplerMarks::GenSpatialIndexOnDemand as u32);
    let spatial_index = spatial_indexes
        .values
        .entry(location_idx)
        .or_insert(build_spatial_index(
            &state.locations[location_idx],
            location_idx,
        ));
    sampler.end(spatial_index_id);
    let update_planets_id = sampler.start(SamplerMarks::UpdatePlanetMovement as u32);
    let (planets, sampler_out) = planet_movement::update_planets(
        &state.locations[location_idx].planets,
        &state.locations[location_idx].star,
        elapsed,
        sampler,
        update_options.limit_area.clone(),
    );
    state.locations[location_idx].planets = planets;
    sampler = sampler_out;

    sampler.end(update_planets_id);
    let update_ast_id = sampler.start(SamplerMarks::UpdateAsteroids as u32);
    state.locations[location_idx].asteroids = planet_movement::update_asteroids(
        &state.locations[location_idx].asteroids,
        &state.locations[location_idx].star,
        elapsed,
    );
    for mut belt in state.locations[location_idx].asteroid_belts.iter_mut() {
        belt.rotation += belt.orbit_speed / 1000.0 / 1000.0 * elapsed as f64;
    }
    sampler.end(update_ast_id);

    let update_ships_navigation_id = sampler.start(SamplerMarks::UpdateShipsNavigation as u32);
    let my_ship_id = find_my_ship(&state, state.my_id).map(|s| s.id);
    state.locations[location_idx].ships = update_ships_navigation(
        &state.locations[location_idx].ships,
        &state.locations[location_idx].planets,
        &state.locations[location_idx].star,
        elapsed,
        my_ship_id,
        client,
        update_options,
    );
    sampler.end(update_ships_navigation_id);
    if !client {
        let initiate_docking_id =
            sampler.start(SamplerMarks::UpdateInitiateShipsDockingByNavigation as u32);
        update_initiate_ship_docking_by_navigation(state, location_idx, prng);
        sampler.end(initiate_docking_id);
    }
    let interpolate_docking_id = sampler.start(SamplerMarks::UpdateInterpolateDockingShips as u32);
    interpolate_docking_ships_position(state, location_idx, update_options);
    sampler.end(interpolate_docking_id);
    let update_ship_manual_movement_id =
        sampler.start(SamplerMarks::UpdateShipsManualMovement as u32);
    update_ships_manual_movement(
        &mut state.locations[location_idx].ships,
        elapsed,
        state.millis,
    );
    sampler.end(update_ship_manual_movement_id);

    let update_ship_tractoring_id = sampler.start(SamplerMarks::UpdateShipsTractoring as u32);
    if !client {
        state.locations[location_idx].ships = tractoring::update_ships_tractoring(
            &state.locations[location_idx].ships,
            &state.locations[location_idx].minerals,
            &state.locations[location_idx].containers,
        );
    }
    sampler.end(update_ship_tractoring_id);
    let cooldowns_id = sampler.start(SamplerMarks::UpdateAbilityCooldowns as u32);
    abilities::update_ships_ability_cooldowns(&mut state.locations[location_idx].ships, elapsed);
    sampler.end(cooldowns_id);

    let update_minerals_id = sampler.start(SamplerMarks::UpdateTractoredMinerals as u32);
    let mut container =
        MovablesContainerBase::new_minerals(state.locations[location_idx].minerals.clone());
    let consume_updates = tractoring::update_tractored_objects(
        &state.locations[location_idx].ships,
        &mut container.movables,
        elapsed,
        &state.players,
    );
    state.locations[location_idx].minerals = container.get_minerals();
    if !client {
        apply_tractored_items_consumption(&mut state, consume_updates)
    }
    sampler.end(update_minerals_id);
    let update_containers_id = sampler.start(SamplerMarks::UpdateTractoredContainers as u32);
    let mut container =
        MovablesContainerBase::new_containers(state.locations[location_idx].containers.clone());
    let consume_updates = tractoring::update_tractored_objects(
        &state.locations[location_idx].ships,
        &mut container.movables,
        elapsed,
        &state.players,
    );
    state.locations[location_idx].containers = container.get_containers();
    if !client {
        apply_tractored_items_consumption(&mut state, consume_updates)
    }
    sampler.end(update_containers_id);

    if !client && !update_options.disable_hp_effects && !state.disable_hp_effects {
        let hp_effects_id = sampler.start(SamplerMarks::UpdateHpEffects as u32);
        update_hp_effects(state, location_idx, elapsed, state.millis, prng);
        sampler.end(hp_effects_id);

        let update_minerals_respawn_id = sampler.start(SamplerMarks::UpdateMineralsRespawn as u32);
        state.locations[location_idx].minerals = update_state_minerals(
            &state.locations[location_idx].minerals,
            &state.locations[location_idx].asteroid_belts,
            prng,
        );
        sampler.end(update_minerals_respawn_id);
        let respawn_id = sampler.start(SamplerMarks::UpdateShipsRespawn as u32);
        update_ships_respawn(&mut state, prng);
        sampler.end(respawn_id);
    }
    let autofocus_id = sampler.start(SamplerMarks::UpdateAutofocus as u32);
    autofocus::update_location_autofocus(&mut state, location_idx, &spatial_index);
    sampler.end(autofocus_id);

    let long_act_ticks = sampler.start(SamplerMarks::UpdateTickLongActionsShips as u32);
    let players_read = state.players.clone();
    let players_by_ship_id_read = index_players_by_ship_id(&players_read);
    let mut to_finish = vec![];

    for i in 0..state.locations[location_idx].ships.len() {
        let ship = &mut state.locations[location_idx].ships[i];
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
                            location_idx,
                        },
                    ));
                }
                return if keep_ticking { Some(new_la) } else { None };
            })
            .collect();
    }
    for (act, player_id, ship_idx) in to_finish.into_iter() {
        finish_long_act(&mut state, player_id, act, client, ship_idx, prng);
    }

    sampler.end(long_act_ticks);

    if !client {
        let wreck_decay_id = sampler.start(SamplerMarks::UpdateWreckDecay as u32);
        update_wreck_decay(state, location_idx, elapsed);
        sampler.end(wreck_decay_id);
    }
    sampler
}

fn update_wreck_decay(state: &mut GameState, location_idx: usize, elapsed_ticks: i64) {
    let mut to_delete = HashSet::new();
    for wreck in state.locations[location_idx].wrecks.iter_mut() {
        wreck.decay_ticks = wreck.decay_ticks - elapsed_ticks as i32;
        if wreck.decay_ticks <= 0 {
            to_delete.insert(wreck.id);
        }
    }
    state.locations[location_idx]
        .wrecks
        .retain(|w| !to_delete.contains(&w.id));
}

pub fn lerp(from: f64, to: f64, percentage: f64) -> f64 {
    return vec2::reduce_precision((to - from) * (percentage.max(0.0).min(1.0)) + from);
}

// and undocking!
fn interpolate_docking_ships_position(
    state: &mut GameState,
    location_idx: usize,
    update_options: &UpdateOptions,
) {
    let planets_read = state.locations[location_idx].planets.clone();
    let planets_by_id = index_planets_by_id(&planets_read);
    let docking_ship_ids: HashMap<Uuid, LongAction> =
        HashMap::from_iter(state.locations[location_idx].ships.iter().filter_map(|s| {
            let long_act = s
                .long_actions
                .iter()
                .filter(|la| matches!(la, LongAction::Dock { .. }))
                .nth(0);
            if let Some(la) = long_act {
                return Some((s.id, la.clone()));
            }
            return None;
        }));
    let undocking_ship_ids: HashMap<Uuid, LongAction> =
        HashMap::from_iter(state.locations[location_idx].ships.iter().filter_map(|s| {
            let long_act = s
                .long_actions
                .iter()
                .filter(|la| matches!(la, LongAction::Undock { .. }))
                .nth(0);
            if let Some(la) = long_act {
                return Some((s.id, la.clone()));
            }
            return None;
        }));
    for ship in state.locations[location_idx].ships.iter_mut() {
        if !update_options.limit_area.contains_vec(&Vec2f64 {
            x: ship.x,
            y: ship.y,
        }) {
            continue;
        }
        if let Some(long_act) = docking_ship_ids.get(&ship.id) {
            match long_act {
                LongAction::Dock {
                    start_pos,
                    to_planet,
                    percentage,
                    ..
                } => {
                    if let Some(planet) = planets_by_id.get(&to_planet) {
                        let target = Vec2f64 {
                            x: planet.x,
                            y: planet.y,
                        };
                        let ship_pos = Vec2f64 {
                            x: ship.x,
                            y: ship.y,
                        };
                        let dir = target.subtract(&ship_pos);
                        ship.rotation = dir.angle_rad(&Vec2f64 { x: 0.0, y: -1.0 });
                        if dir.x < 0.0 {
                            ship.rotation = -ship.rotation;
                        }

                        ship.x = lerp(start_pos.x, planet.x, *percentage as f64 / 100.0);
                        ship.y = lerp(start_pos.y, planet.y, *percentage as f64 / 100.0);
                    }
                }
                _ => {}
            }
        } else if let Some(long_act) = undocking_ship_ids.get(&ship.id) {
            match long_act {
                LongAction::Undock {
                    from_planet,
                    end_pos,
                    percentage,
                    ..
                } => {
                    if let Some(planet) = planets_by_id.get(&from_planet) {
                        let from_pos = Vec2f64 {
                            x: planet.x,
                            y: planet.y,
                        };
                        let ship_pos = Vec2f64 {
                            x: ship.x,
                            y: ship.y,
                        };
                        let dir = ship_pos.subtract(&from_pos);
                        ship.rotation = dir.angle_rad(&Vec2f64 { x: 0.0, y: -1.0 });
                        if dir.x < 0.0 {
                            ship.rotation = -ship.rotation;
                        }

                        ship.x = lerp(from_pos.x, end_pos.x, *percentage as f64 / 100.0);
                        ship.y = lerp(from_pos.y, end_pos.y, *percentage as f64 / 100.0);
                    }
                }
                _ => {}
            }
        }
    }
}

fn update_initiate_ship_docking_by_navigation(
    state: &mut GameState,
    location_idx: usize,
    prng: &mut SmallRng,
) {
    let ships = &state.locations[location_idx].ships;
    let planets_by_id = index_planets_by_id(&state.locations[location_idx].planets);
    let mut to_dock = vec![];
    for i in 0..ships.len() {
        let ship = &ships[i];
        if let Some(t) = ship.dock_target {
            if let Some(planet) = planets_by_id.get(&t) {
                let planet_pos = Vec2f64 {
                    x: planet.x,
                    y: planet.y,
                };
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                if planet_pos.euclidean_distance(&ship_pos)
                    < (planet.radius * planet.radius * SHIP_DOCKING_RADIUS_COEFF)
                        .max(MIN_SHIP_DOCKING_RADIUS)
                {
                    let docks_in_progress = ship
                        .long_actions
                        .iter()
                        .any(|a| matches!(a, LongAction::Dock { .. }));

                    if !docks_in_progress {
                        to_dock.push((
                            ShipIdx {
                                location_idx,
                                ship_idx: i,
                            },
                            planet.id,
                        ))
                    }
                }
            }
        }
    }
    for (ship_idx, planet_id) in to_dock {
        try_start_long_action_ship(
            state,
            &ship_idx,
            LongActionStart::Dock {
                to_planet: planet_id,
            },
            prng,
        );
    }
}

// keep synced with world.ts
const MANUAL_MOVEMENT_INACTIVITY_DROP_MS: i32 = 500;

fn update_ships_manual_movement(ships: &mut Vec<Ship>, elapsed_micro: i64, current_tick: u32) {
    for ship in ships.iter_mut() {
        let (new_move, new_pos) = if let Some(params) = &mut ship.movement_markers.gas {
            if (params.last_tick as i32 - current_tick as i32).abs()
                > MANUAL_MOVEMENT_INACTIVITY_DROP_MS
            {
                (None, None)
            } else {
                let sign = if params.forward { 1.0 } else { -1.0 };
                let distance = ship
                    .movement_definition
                    .get_current_linear_move_speed_per_tick()
                    * elapsed_micro as f64
                    * sign;
                let shift = Vec2f64 { x: 0.0, y: 1.0 }
                    .rotate(ship.rotation)
                    .scalar_mul(distance);
                let new_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                }
                .add(&shift);
                (Some(params.clone()), Some(new_pos))
            }
        } else {
            (None, None)
        };
        ship.movement_markers.gas = new_move;
        if let Some(new_pos) = new_pos {
            ship.set_from(&new_pos);
        }
        let (new_move, new_rotation) = if let Some(params) = &ship.movement_markers.turn {
            if (params.last_tick as i32 - current_tick as i32).abs()
                > MANUAL_MOVEMENT_INACTIVITY_DROP_MS
            {
                (None, None)
            } else {
                let sign = if params.forward { 1.0 } else { -1.0 };
                let diff =
                    deg_to_rad(SHIP_TURN_SPEED_DEG * elapsed_micro as f64 / 1000.0 / 1000.0 * sign);
                (Some(params.clone()), Some(ship.rotation + diff))
            }
        } else {
            (None, None)
        };
        ship.movement_markers.turn = new_move;
        if let Some(new_rotation) = new_rotation {
            ship.rotation = new_rotation;
        }
    }
}

fn apply_tractored_items_consumption(
    mut state: &mut &mut GameState,
    consume_updates: Vec<(Uuid, Box<dyn IMovable>)>,
) {
    for pup in consume_updates {
        let ticks = state.millis.clone();
        let pair = indexing::find_player_and_ship_mut(&mut state, pup.0);
        let picked_items = InventoryItem::from(pup.1);
        if let Some(ship) = pair.1 {
            ship.local_effects.push(LocalEffect::PickUp {
                id: new_id(),
                text: format!("Pick up: {}", InventoryItem::format(&picked_items)),
                position: Default::default(),
                tick: ticks,
            });
            add_items(&mut ship.inventory, picked_items);
        }
    }
}

const MAX_NAT_SPAWN_MINERALS: u32 = 10;

fn update_state_minerals(
    existing: &Vec<NatSpawnMineral>,
    belts: &Vec<AsteroidBelt>,
    prng: &mut SmallRng,
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

pub fn spawn_mineral(location: &mut Location, rarity: Rarity, pos: Vec2f64, prng: &mut SmallRng) {
    let mut min = gen_mineral(prng, pos);
    min.rarity = rarity;
    location.minerals.push(min)
}

pub fn spawn_container(loc: &mut Location, at: Vec2f64) {
    let mut prng = get_prng();
    let mut container = Container::random(&mut prng);
    container.position = at;
    loc.containers.push(container);
}

fn seed_mineral(belts: &Vec<AsteroidBelt>, prng: &mut SmallRng) -> NatSpawnMineral {
    let picked = prng.gen_range(0, belts.len());
    let belt = &belts[picked];
    let mut pos_in_belt = gen_pos_in_belt(belt, prng);
    pos_in_belt.reduce_precision();
    gen_mineral(prng, pos_in_belt)
}

fn gen_mineral(prng: &mut SmallRng, pos: Vec2f64) -> NatSpawnMineral {
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

fn gen_pos_in_belt(belt: &AsteroidBelt, prng: &mut SmallRng) -> Vec2f64 {
    let range = prng.gen_range(
        belt.radius - belt.width / 2.0,
        belt.radius + belt.width / 2.0,
    );
    let angle_rad = prng.gen_range(0.0, PI * 2.0);
    let x = angle_rad.cos() * range;
    let y = angle_rad.sin() * range;
    Vec2f64 { x, y }
}

fn update_ships_respawn(state: &mut GameState, prng: &mut SmallRng) {
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
        try_start_long_action(state, player_id, LongActionStart::Respawn, prng);
    }
}

pub fn fire_saved_event(state: &mut GameState, event: GameEvent) {
    state.events.push_back(event.clone());
    match event {
        // list of the events that should only be handled inside world events, and not
        // as global events
        GameEvent::ShipDocked { .. } => {}
        GameEvent::DialogueTriggerRequest { .. } => {}
        GameEvent::PirateSpawn { .. } => {}
        GameEvent::ShipDied { .. } => {}
        _ => {
            fire_event(event);
        }
    }
}

const SHIP_REGEN_PER_SEC: f64 = 5.0;
const STAR_INSIDE_DAMAGE_PER_SEC: f64 = 50.0;
const STAR_DAMAGE_PER_SEC_NEAR: f64 = 25.0;
const STAR_DAMAGE_PER_SEC_FAR: f64 = 7.5;
const STAR_INSIDE_RADIUS: f64 = 0.5;
const STAR_CLOSE_RADIUS: f64 = 0.68;
const STAR_FAR_RADIUS: f64 = 1.1;
const MAX_LOCAL_EFF_LIFE_MS: i32 = 10 * 1000;
const DMG_EFFECT_MIN: f64 = 5.0;
const HEAL_EFFECT_MIN: f64 = 5.0;

const WRECK_DECAY_TICKS: i32 = 10 * 1000 * 1000;
pub const PLAYER_RESPAWN_TIME_MC: i32 = 10 * 1000 * 1000;
pub const PLANET_HEALTH_REGEN_PER_TICK: f64 = 1.0 / 1000.0 / 1000.0;

pub fn update_hp_effects(
    state: &mut GameState,
    location_idx: usize,
    elapsed_micro: i64,
    current_tick: u32,
    prng: &mut SmallRng,
) {
    let state_id = state.id;
    let players_by_ship_id = index_players_by_ship_id(&state.players).clone();
    if let Some(star) = state.locations[location_idx].star.clone() {
        let star_center = Vec2f64 {
            x: star.x,
            y: star.y,
        };
        for mut ship in state.locations[location_idx].ships.iter_mut() {
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };

            let dist_to_star = ship_pos.euclidean_distance(&star_center);
            let rr = dist_to_star / star.radius;

            let star_damage = if rr < STAR_INSIDE_RADIUS {
                STAR_INSIDE_DAMAGE_PER_SEC
            } else if rr < STAR_CLOSE_RADIUS {
                STAR_DAMAGE_PER_SEC_NEAR
            } else if rr < STAR_FAR_RADIUS {
                STAR_DAMAGE_PER_SEC_FAR
            } else {
                0.0
            };
            //eprintln!("star_damage {}", star_damage);
            let star_damage = star_damage * elapsed_micro as f64 / 1000.0 / 1000.0;
            ship.acc_periodic_dmg += star_damage;

            if ship.acc_periodic_dmg >= DMG_EFFECT_MIN {
                let dmg_done = ship.acc_periodic_dmg.floor() as i32;
                ship.acc_periodic_dmg = 0.0;
                ship.health.current = (ship.health.current - dmg_done as f64).max(0.0);
                ship.local_effects.push(LocalEffect::DmgDone {
                    id: prng_id(prng),
                    hp: -dmg_done,
                    tick: current_tick,
                    ship_id: ship.id,
                });
            }

            if star_damage <= 0.0
                && ship.health.current < ship.health.max
                && ship.health.regen_per_tick.is_some()
            {
                let regen = ship.health.regen_per_tick.unwrap_or(0.0) * elapsed_micro as f64;
                ship.acc_periodic_heal += regen;
            }

            if ship.acc_periodic_heal >= HEAL_EFFECT_MIN {
                let heal = ship.acc_periodic_heal.floor() as i32;
                ship.acc_periodic_heal = 0.0;
                ship.health.current = ship.health.max.min(ship.health.current + heal as f64);
                ship.local_effects.push(LocalEffect::Heal {
                    id: prng_id(prng),
                    hp: heal as i32,
                    tick: current_tick,
                    ship_id: ship.id,
                });
            }

            ship.local_effects = ship
                .local_effects
                .iter()
                .filter(|e| {
                    if let Some(tick) = match &e {
                        LocalEffect::Unknown { .. } => None,
                        LocalEffect::DmgDone { tick, .. } => Some(tick),
                        LocalEffect::Heal { tick, .. } => Some(tick),
                        LocalEffect::PickUp { tick, .. } => Some(tick),
                    } {
                        return (*tick as i32 - current_tick as i32).abs() < MAX_LOCAL_EFF_LIFE_MS;
                    }
                    return false;
                })
                .map(|e| e.clone())
                .collect::<Vec<_>>()
        }
    }

    let mut ships_to_die = vec![];
    state.locations[location_idx].ships = state.locations[location_idx]
        .ships
        .iter()
        .filter_map(|ship| {
            if ship.health.current > 0.0 {
                Some(ship.clone())
            } else {
                ships_to_die.push((ship.clone(), players_by_ship_id.get(&ship.id).map(|p| p.id)));
                None
            }
        })
        .collect::<Vec<_>>();
    for (ship_clone, pid) in ships_to_die.into_iter() {
        state.locations[location_idx].wrecks.push(Wreck {
            position: ship_clone.get_position(),
            id: prng_id(prng),
            rotation: ship_clone.rotation,
            radius: ship_clone.radius,
            color: ship_clone.color.clone(),
            decay_normalized: 0.0,
            decay_ticks: WRECK_DECAY_TICKS,
        });
        let event =
            if let Some(player) = pid.and_then(|pid| indexing::find_my_player_mut(state, pid)) {
                player.ship_id = None;
                player.money -= 1000;
                player.money = player.money.max(0);
                GameEvent::ShipDied {
                    state_id,
                    ship: ship_clone,
                    player_id: Some(player.id),
                }
            } else {
                GameEvent::ShipDied {
                    state_id,
                    ship: ship_clone,
                    player_id: None,
                }
            };
        fire_saved_event(state, event);
    }

    for planet in state.locations[location_idx].planets.iter_mut() {
        if let Some(health) = &mut planet.health {
            if health.current < health.max {
                health.current += PLANET_HEALTH_REGEN_PER_TICK * elapsed_micro as f64;
                health.current = health.current.min(health.max);
            }
        }
    }
}

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
    prng: &mut SmallRng,
) {
    let mut player = Player::new(player_id, &state.mode, prng);
    player.is_bot = is_bot;
    player.name = name.unwrap_or(player_id.to_string());
    state.players.push(player);
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum Movement {
    Unknown,
    ShipMonotonous {
        move_speed: f64,
        turn_speed: f64,
        current_move_speed: f64,
        current_turn_speed: f64,
    },
    ShipAccelerated {
        max_move_speed: f64,
        current_move_speed: f64,
        current_turn_speed: f64,
        acc_move: f64,
        max_turn_speed: f64,
        acc_turn: f64,
    },
    RadialMonotonous {
        // instead of defining the speed, in order
        // for interpolation optimization to work, we
        // need to restrict possible locations of the planet
        // so it's fully periodical, e.g. such P exists that position(t = P) = initial,
        // position (t  = 2P) = initial, etc
        full_period_ticks: f64,
        radius_to_anchor: f64,
        clockwise: bool,
        anchor: ObjectSpecifier,
        relative_position: Vec2f64,
        interpolation_hint: Option<u32>,
    },
}

impl Movement {
    pub fn get_current_linear_move_speed_per_tick(&self) -> f64 {
        match self {
            Movement::Unknown => 0.0,
            Movement::ShipMonotonous { move_speed, .. } => {
                // This is kind of incorrect for a stopped ship, but to get it we need
                // to unify movement markers with movement definition
                *move_speed
            }
            Movement::ShipAccelerated {
                current_move_speed, ..
            } => *current_move_speed,
            Movement::RadialMonotonous { .. } => 0.0,
        }
    }
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
    pub fn pirate(at: Option<Vec2f64>) -> ShipTemplate {
        ShipTemplate {
            at,
            npc_traits: Some(vec![AiTrait::ImmediatePlanetLand]),
            abilities: Some(vec![Ability::BlowUpOnLand]),
            name: Some("Pirate".to_string()),
            health: Some(Health::new(40.0)),
            movement: Some(Movement::ShipMonotonous {
                move_speed: 10.0 / 1000.0 / 1000.0,
                turn_speed: SHIP_TURN_SPEED_DEG / 1000.0 / 1000.0,
                current_move_speed: 0.0,
                current_turn_speed: 0.0,
            }),
            properties: Some(vec![
                ObjectProperty::MoneyOnKill { amount: 100 },
                ObjectProperty::PirateShip,
            ]),
        }
    }

    pub fn player(at: Option<Vec2f64>) -> ShipTemplate {
        ShipTemplate {
            at,
            npc_traits: None,
            abilities: None,
            name: None,
            health: Some(Health::new_regen(
                100.0,
                SHIP_REGEN_PER_SEC / 1000.0 / 1000.0,
            )),
            movement: Some(Movement::ShipMonotonous {
                move_speed: 20.0 / 1000.0 / 1000.0,
                turn_speed: SHIP_TURN_SPEED_DEG / 1000.0 / 1000.0,
                current_move_speed: 0.0,
                current_turn_speed: 0.0,
            }),
            properties: None,
        }
    }
}

pub fn spawn_ship<'a>(
    state: &'a mut GameState,
    player_id: Option<Uuid>,
    template: ShipTemplate,
    prng: &mut SmallRng,
) -> &'a Ship {
    let rand_planet = get_random_planet(&state.locations[0].planets, None, prng);
    let mut at = template.at;
    if rand_planet.is_some() && at.is_none() {
        let p = rand_planet.unwrap();
        at = Some(Vec2f64 {
            x: p.x.clone(),
            y: p.y.clone(),
        })
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

    match player_id {
        None => fire_event(GameEvent::ShipSpawned {
            state_id: state.id,
            ship: ship.clone(),
            player_id: None,
        }),
        Some(player_id) => {
            state
                .players
                .iter_mut()
                .find(|p| p.id == player_id)
                .map(|p| {
                    p.ship_id = Some(ship.id);
                    fire_event(GameEvent::ShipSpawned {
                        state_id,
                        ship: ship.clone(),
                        player_id: Some(p.id),
                    });
                });
        }
    }
    state.locations[0].ships.push(ship);
    &state.locations[0].ships[state.locations[0].ships.len() - 1]
}

pub fn update_ships_navigation(
    ships: &Vec<Ship>,
    planets: &Vec<Planet>,
    star: &Option<Star>,
    elapsed_micro: i64,
    _my_ship_id: Option<Uuid>,
    _client: bool,
    update_options: &UpdateOptions,
) -> Vec<Ship> {
    let mut res = vec![];
    let planets_with_star = make_bodies_from_planets(&planets, star);
    let bodies_by_id = index_bodies_by_id(planets_with_star);
    let docking_ship_ids: HashSet<Uuid> = HashSet::from_iter(ships.iter().filter_map(|s| {
        let long_act = s
            .long_actions
            .iter()
            .filter(|la| matches!(la, LongAction::Dock { .. }))
            .nth(0);
        if let Some(_la) = long_act {
            return Some(s.id);
        }
        return None;
    }));
    let undocking_ship_ids: HashSet<Uuid> = HashSet::from_iter(ships.iter().filter_map(|s| {
        let long_act = s
            .long_actions
            .iter()
            .filter(|la| matches!(la, LongAction::Undock { .. }))
            .nth(0);
        if let Some(_la) = long_act {
            return Some(s.id);
        }
        return None;
    }));

    for mut ship in ships.clone() {
        // impossible to optimize yet, simply because the
        // movement by trajectory is coupled with trajectory building,
        // so this is required for smooth client movement of other ships
        // if client && ship.id != my_ship_id.unwrap_or(Uuid::default()) {
        //     res.push(ship);
        //     continue;
        // }
        if docking_ship_ids.contains(&ship.id)
            || undocking_ship_ids.contains(&ship.id)
            || !update_options.limit_area.contains_vec(&Vec2f64 {
                x: ship.x,
                y: ship.y,
            })
        {
            ship.trajectory = vec![];
            res.push(ship);
            continue;
        }
        if !ship.docked_at.is_some() {
            let max_shift = ship
                .movement_definition
                .get_current_linear_move_speed_per_tick()
                * elapsed_micro as f64;

            if let Some(target) = ship.navigate_target {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let dist = target.euclidean_distance(&ship_pos);
                let dir = target.subtract(&ship_pos);
                ship.rotation = dir.angle_rad(&Vec2f64 { x: 0.0, y: -1.0 });
                if dir.x < 0.0 {
                    ship.rotation = -ship.rotation;
                }
                if dist > 0.0 {
                    ship.trajectory =
                        build_trajectory_to_point(ship_pos, &target, &ship.movement_definition);
                    if dist > max_shift {
                        let new_pos = move_ship(&target, &ship_pos, max_shift);
                        ship.set_from(&new_pos);
                    } else {
                        ship.set_from(&target);
                        ship.navigate_target = None;
                    }
                } else {
                    ship.navigate_target = None;
                }
            } else if let Some(target) = ship.dock_target {
                if let Some(planet) = bodies_by_id.get(&target) {
                    let ship_pos = Vec2f64 {
                        x: ship.x,
                        y: ship.y,
                    };
                    let planet_anchor = bodies_by_id.get(&planet.get_anchor_id()).unwrap();
                    ship.trajectory = build_trajectory_to_body(
                        ship_pos,
                        &planet,
                        planet_anchor,
                        &ship.movement_definition,
                    );
                    if let Some(first) = ship.trajectory.clone().get(0) {
                        let dir = first.subtract(&ship_pos);
                        ship.rotation = dir.angle_rad(&Vec2f64 { x: 0.0, y: -1.0 });
                        if dir.x < 0.0 {
                            ship.rotation = -ship.rotation;
                        }
                        let new_pos = move_ship(first, &ship_pos, max_shift);
                        ship.set_from(&new_pos);
                    }
                } else {
                    eprintln!("Attempt to navigate to non-existent planet {}", target);
                    ship.dock_target = None;
                }
            } else {
                ship.navigate_target = None;
            }
        }
        res.push(ship);
    }
    res
}

pub fn dock_ship(
    state: &mut GameState,
    ship_idx: ShipIdx,
    player_idx: Option<usize>,
    body: Box<dyn IBody>,
) {
    let ship_clone = {
        let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
        ship.docked_at = Some(body.get_id());
        ship.dock_target = None;
        ship.x = body.get_x();
        ship.y = body.get_y();
        ship.trajectory = vec![];
        ship.clone()
    };
    fire_saved_event(
        state,
        GameEvent::ShipDocked {
            ship: ship_clone,
            planet: Planet::from(body),
            player_id: player_idx.map(|idx| state.players[idx].id),
            state_id: state.id,
        },
    );
}

pub fn undock_ship(
    state: &mut GameState,
    ship_idx: ShipIdx,
    client: bool,
    player_idx: Option<usize>,
    prng: &mut SmallRng,
) {
    let state_read = state.clone();
    let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    if let Some(planet_id) = ship.docked_at {
        ship.docked_at = None;
        if let Some(planet) = find_planet(&state_read, &planet_id) {
            let planet = planet.clone();
            ship.x = planet.x;
            ship.y = planet.y;
            if !client {
                fire_event(GameEvent::ShipUndocked {
                    state_id: state.id,
                    ship: ship.clone(),
                    planet,
                    player_id: player_idx.map(|player_idx| state.players[player_idx].id),
                });
                try_start_long_action_ship(
                    state,
                    &ship_idx,
                    LongActionStart::Undock {
                        from_planet: planet_id,
                    },
                    prng,
                );
            }
        }
    }
}

fn move_ship(target: &Vec2f64, ship_pos: &Vec2f64, max_shift: f64) -> Vec2f64 {
    let dir = target.subtract(&ship_pos).normalize();

    let shift = dir.scalar_mul(max_shift);
    let new_pos = ship_pos.add(&shift);
    new_pos
}

// TODO for some weird reason, it works for anchor_tier=2 too, however I do not support it here!
fn build_trajectory_to_body(
    from: Vec2f64,
    to: &Box<dyn IBody>,
    to_anchor: &Box<dyn IBody>,
    for_movement: &Movement,
) -> Vec<Vec2f64> {
    let bodies: Vec<Box<dyn IBody>> = vec![to.clone(), to_anchor.clone()];
    let mut anchors = planet_movement::build_anchors_from_bodies(bodies);
    let mut shifts = HashMap::new();
    let mut counter = 0;
    let mut current_target = Planet::from(to.clone());
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift =
        TRAJECTORY_STEP_MICRO as f64 * for_movement.get_current_linear_move_speed_per_tick();
    loop {
        let current_target_pos = Vec2f64 {
            x: current_target.x,
            y: current_target.y,
        };
        let distance = current_target_pos.euclidean_distance(&current_from);
        let should_break =
            counter >= TRAJECTORY_MAX_ITER || distance < to.get_radius() / 2.0 + TRAJECTORY_EPS;
        if should_break {
            break;
        }
        current_from = move_ship(&current_target_pos, &current_from, max_shift);
        current_target = Planet::from(planet_movement::simulate_planet_movement(
            TRAJECTORY_STEP_MICRO,
            &mut anchors,
            &mut shifts,
            Box::new(current_target.clone()),
        ));
        result.push(current_from);
        counter += 1;
    }
    let planet_pos = Vec2f64 {
        x: current_target.x,
        y: current_target.y,
    };
    // remove artifacts from the tail
    let mut count = 2;
    result = result
        .into_iter()
        .take_while(|p| {
            let cond = p.euclidean_distance(&planet_pos) < to.get_radius();
            if cond {
                count -= 1;
                return count > 0;
            }
            return true;
        })
        .collect::<Vec<_>>();
    result
}

pub fn build_trajectory_to_point(
    from: Vec2f64,
    to: &Vec2f64,
    for_movement: &Movement,
) -> Vec<Vec2f64> {
    let mut counter = 0;
    let current_target = to.clone();
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift =
        TRAJECTORY_STEP_MICRO as f64 * for_movement.get_current_linear_move_speed_per_tick();
    loop {
        let target_pos = Vec2f64 {
            x: current_target.x,
            y: current_target.y,
        };
        let distance = target_pos.euclidean_distance(&current_from);
        let should_break = counter >= TRAJECTORY_MAX_ITER || distance < max_shift;
        if should_break {
            break;
        }
        current_from = move_ship(&target_pos, &current_from, max_shift);
        result.push(current_from);
        counter += 1;
    }
    result
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
    let diff = current_ticks - last_trigger;
    let trigger = diff > interval_ticks;
    if trigger {
        return Some(diff);
    } else {
        return None;
    }
}

pub fn update_rule_specifics(
    state: &mut GameState,
    prng: &mut SmallRng,
    sampler: &mut Sampler,
    _client: bool,
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
            update_quests(state, prng);
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

fn update_quests(state: &mut GameState, prng: &mut SmallRng) {
    let quest_planets = state.locations[0].planets.clone();
    let mut any_new_quests = vec![];
    let player_ids = state.players.iter().map(|p| p.id).collect::<Vec<_>>();
    for player_id in player_ids {
        if let (Some(mut player), Some(ship)) = indexing::find_player_and_ship_mut(state, player_id)
        {
            if player.quest.is_none() {
                cargo_rush::generate_random_quest(player, &quest_planets, ship.docked_at, prng);
                any_new_quests.push(player_id);
            } else {
                let quest_id = player.quest.as_ref().map(|q| q.id).unwrap();
                if !has_quest_item(&ship.inventory, quest_id)
                    && player.quest.as_ref().unwrap().state == CargoDeliveryQuestState::Picked
                {
                    player.quest = None;
                    log!(format!(
                        "Player {} has failed quest {} due to not having item",
                        player_id, quest_id
                    ));
                }
            }
        }
    }
    if any_new_quests.len() > 0 {
        substitute_notification_texts(state, HashSet::from_iter(any_new_quests));
    }
}

pub fn remove_player_from_state(conn_id: Uuid, state: &mut GameState) {
    // intentionally drop the extracted result
    indexing::find_and_extract_ship(state, conn_id);
    state.players.iter().position(|p| p.id == conn_id).map(|i| {
        state.players.remove(i);
    });
}

pub fn try_replace_ship(state: &mut GameState, updated_ship: &Ship, player_id: Uuid) -> bool {
    let old_ship_index = indexing::find_my_ship_index(&state, player_id);
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

pub fn mutate_ship_no_lock(
    client_id: Uuid,
    mutate_cmd: PlayerActionRust,
    state: &mut GameState,
    prng: &mut SmallRng,
) -> Option<(Ship, ShipIdx)> {
    let old_ship_index = indexing::find_my_ship_index(&state, client_id);
    if old_ship_index.is_none() {
        warn!("No old instance of ship");
        return None;
    }
    force_update_to_now(state);
    let updated_ship =
        ship_action::apply_player_action(mutate_cmd, &state, old_ship_index.clone(), false, prng);
    if let Some(updated_ship) = updated_ship {
        let replaced = try_replace_ship(state, &updated_ship, client_id);
        if replaced {
            return Some((updated_ship, old_ship_index.unwrap()));
        }
        warn!("Couldn't replace ship");
        return None;
    }
    force_update_to_now(state);
    warn!("Ship update was invalid");
    return None;
}

pub fn find_player_location_idx(state: &GameState, player_id: Uuid) -> Option<i32> {
    let player = indexing::find_my_player(state, player_id);
    if player.is_none() {
        return None;
    }
    let player = player.unwrap();
    if player.ship_id.is_none() {
        return None;
    }
    let ship_id = player.ship_id.unwrap();
    let mut idx = -1;
    let mut found = false;
    for loc in state.locations.iter() {
        idx += 1;
        for ship in loc.ships.iter() {
            if ship.id == ship_id {
                found = true;
                break;
            }
        }
        if found {
            break;
        }
    }
    return if !found { None } else { Some(idx) };
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
    }
}

pub fn make_room(
    mode: &GameMode,
    room_id: Uuid,
    prng: &mut SmallRng,
    bots_seed: Option<String>,
) -> (Uuid, Room) {
    let room_name = format!("{} - {}", mode, room_id);
    let state = system_gen::seed_state(&mode, random_stuff::random_hex_seed_seeded(prng));
    let state_id = state.id.clone();
    let mut room = Room {
        id: room_id,
        name: room_name,
        state,
        dialogue_states: Default::default(),
        last_players_mark: None,
        bots: vec![],
        bots_seed,
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

pub fn build_full_spatial_indexes(state: &GameState) -> SpatialIndexes {
    let mut values = HashMap::new();
    for i in 0..state.locations.len() {
        let loc = &state.locations[i];
        values.insert(i, build_spatial_index(loc, i));
    }
    SpatialIndexes { values }
}

pub const BOT_ACTION_TIME_TICKS: i64 = 200 * 1000;

pub fn update_room(
    mut prng: &mut SmallRng,
    mut sampler: Sampler,
    elapsed_micro: i64,
    room: &Room,
    d_table: &DialogueTable,
) -> (SpatialIndexes, Room, Sampler) {
    let spatial_indexes_id = sampler.start(SamplerMarks::GenFullSpatialIndexes as u32);
    let mut spatial_indexes = build_full_spatial_indexes(&room.state);
    sampler.end(spatial_indexes_id);
    let mut modified_dialogue_states = room.dialogue_states.clone();
    let (new_state, mut sampler) = update_world(
        room.state.clone(),
        elapsed_micro,
        false,
        sampler,
        UpdateOptions {
            disable_hp_effects: false,
            limit_area: AABB::maxed(),
        },
        &mut spatial_indexes,
        &mut prng,
        &mut modified_dialogue_states,
        &d_table,
    );
    let mut room = room.clone();
    room.state = new_state;
    room.dialogue_states = modified_dialogue_states;

    spatial_indexes = build_full_spatial_indexes(&room.state);

    // by default, bot behavior is non-deterministic, unless we explicitly requested it in room setup
    let mut bot_prng = room.bots_seed.clone().map_or(get_prng(), |s| seed_prng(s));

    if let Some(bot_action_elapsed) = every_diff(
        BOT_ACTION_TIME_TICKS as u32,
        room.state.ticks as u32,
        room.state
            .interval_data
            .get(&TimeMarks::BotAction)
            .map(|m| *m),
    ) {
        room.state
            .interval_data
            .insert(TimeMarks::BotAction, room.state.ticks as u32);
        let bots_mark = sampler.start(SamplerMarks::UpdateBots as u32);
        let bot_players_mark = sampler.start(SamplerMarks::UpdateBotsPlayers as u32);
        let mut d_states_clone = room.dialogue_states.clone();
        do_bot_players_actions(
            &mut room,
            &mut d_states_clone,
            &d_table,
            bot_action_elapsed as i64,
            &spatial_indexes,
            &mut bot_prng,
        );
        room.dialogue_states = d_states_clone;
        sampler.end(bot_players_mark);
        let npcs_mark = sampler.start(SamplerMarks::UpdateBotsNPCs as u32);
        do_bot_npcs_actions(
            &mut room,
            bot_action_elapsed as i64,
            &spatial_indexes,
            &mut bot_prng,
        );
        sampler.end(npcs_mark);
        sampler.end(bots_mark);
    }

    (spatial_indexes, room, sampler)
}
