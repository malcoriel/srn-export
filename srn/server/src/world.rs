use std::borrow::{Borrow, BorrowMut};
use std::collections::{HashMap, HashSet};
#[allow(deprecated)]
use std::f64::{INFINITY, NEG_INFINITY};
use std::f64::consts::PI;
use std::iter::FromIterator;

use chrono::Utc;
use itertools::{Either, Itertools};
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use uuid::*;
use uuid::Uuid;
use wasm_bindgen::prelude::*;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};

use crate::{fire_event, planet_movement, market};
use crate::{DEBUG_PHYSICS, new_id};
use crate::inventory::{add_item, has_quest_item, InventoryItem, InventoryItemType, shake_items};
use crate::perf::Sampler;
use crate::planet_movement::{build_anchors_from_bodies, IBody, index_bodies_by_id, make_bodies_from_planets};
use crate::random_stuff::{
    gen_asteroid_radius, gen_asteroid_shift, gen_color, gen_mineral_props, gen_planet_count,
    gen_planet_gap, gen_planet_name, gen_planet_orbit_speed, gen_planet_radius,
    gen_random_photo_id, gen_sat_count, gen_sat_gap, gen_sat_name, gen_sat_orbit_speed,
    gen_sat_radius, gen_star_name, gen_star_radius,
};
use crate::system_gen::{str_to_hash, system_gen};
use crate::vec2::{AsVec2f64, Precision, Vec2f64};
use crate::market::{Market, init_all_planets_market};

const SHIP_SPEED: f64 = 20.0;
const ORB_SPEED_MULT: f64 = 1.0;
const SEED_TIME: i64 = 9321 * 1000 * 1000;
const MAX_ORBIT: f64 = 450.0;
const TRAJECTORY_STEP_MICRO: i64 = 250 * 1000;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;
const ASTEROID_COUNT: u32 = 200;
const ASTEROID_BELT_RANGE: f64 = 100.0;

pub type PlayerId = Uuid;


#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum GameMode {
    Unknown,
    CargoRush,
    Tutorial,
    Sandbox,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ManualMoveUpdate {
    pub position: Vec2f64,
    pub rotation: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ShipActionRust {
    Unknown,
    Move(ManualMoveUpdate),
    Dock,
    Navigate(Vec2f64),
    DockNavigate(Uuid),
    Tractor(Uuid),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShipActionType {
    Unknown = 0,
    Move = 1,
    Dock = 2,
    Navigate = 3,
    DockNavigate = 4,
    Tractor = 5,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShipAction {
    pub s_type: ShipActionType,
    pub data: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct HpEffect {
    pub hp: i32,
    pub id: Uuid,
    pub tick: u32,
}

pub fn make_leaderboard(all_players: &Vec<Player>) -> Option<Leaderboard> {
    let rating = all_players
        .into_iter()
        .sorted_by(|a, b| Ord::cmp(&b.money, &a.money))
        .map(|p| (p.clone(), get_player_score(p)))
        .collect::<Vec<_>>();
    let winner: String = rating
        .iter()
        .nth(0)
        .map_or("Nobody".to_string(), |p| p.0.name.clone());
    Some(Leaderboard { rating, winner })
}

fn get_player_score(p: &Player) -> u32 {
    p.money as u32
}

pub fn update_ships_on_planets(planets: &Vec<Planet>, ships: &Vec<Ship>) -> Vec<Ship> {
    let by_id = index_planets_by_id(planets);
    ships
        .into_iter()
        .map(|s| {
            let mut ship = s.clone();
            if let Some(docked_at) = ship.docked_at {
                by_id.get(&docked_at).map(|p| {
                    ship.x = p.x;
                    ship.y = p.y;
                });
            }
            ship
        })
        .collect::<Vec<_>>()
}

pub fn index_planets_by_id(planets: &Vec<Planet>) -> HashMap<Uuid, &Planet> {
    let mut by_id = HashMap::new();
    for p in planets.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

fn index_players_by_id(players: &Vec<Player>) -> HashMap<Uuid, &Player> {
    let mut by_id = HashMap::new();
    for p in players.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

fn index_ships_by_id(ships: &Vec<Ship>) -> HashMap<Uuid, &Ship> {
    let mut by_id = HashMap::new();
    for p in ships.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

fn index_ships_by_tractor_target(ships: &Vec<Ship>) -> HashMap<Uuid, Vec<&Ship>> {
    let mut by_target = HashMap::new();
    for p in ships.iter() {
        if let Some(tt) = p.tractor_target {
            let entry = by_target.entry(tt).or_insert(vec![]);
            entry.push(p);
        }
    }
    by_target
}

fn index_players_by_ship_id(players: &Vec<Player>) -> HashMap<Uuid, &Player> {
    let mut by_id = HashMap::new();
    for p in players.iter() {
        if let Some(ship_id) = p.ship_id {
            by_id.entry(ship_id).or_insert(p);
        }
    }
    by_id
}

fn index_players_by_ship_id_mut(players: &mut Vec<Player>) -> HashMap<Uuid, &mut Player> {
    let mut by_id = HashMap::new();
    for p in players.iter_mut() {
        if let Some(ship_id) = p.ship_id {
            by_id.entry(ship_id).or_insert(p);
        }
    }
    by_id
}

pub fn generate_random_quest(planets: &Vec<Planet>, docked_at: Option<Uuid>) -> Option<Quest> {
    let mut rng: ThreadRng = rand::thread_rng();
    if planets.len() <= 0 {
        return None;
    }
    let from = get_random_planet(planets, docked_at, &mut rng);
    if from.is_none() {
        return None;
    }
    let from = from.unwrap();
    let delivery = planets
        .into_iter()
        .filter(|p| p.id != from.id)
        .collect::<Vec<_>>();
    let to = &delivery[rng.gen_range(0, delivery.len())];
    let reward = rng.gen_range(500, 1001);
    return Some(Quest {
        id: new_id(),
        from_id: from.id,
        to_id: to.id,
        state: CargoDeliveryQuestState::Started,
        reward,
    });
}

fn get_random_planet<'a>(
    planets: &'a Vec<Planet>,
    docked_at: Option<Uuid>,
    rng: &mut ThreadRng,
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
}


#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, )]
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

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, )]
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

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, )]
pub struct Star {
    pub id: Uuid,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    pub rotation: f64,
    pub color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum GameEvent {
    Unknown,
    ShipDocked {
        ship: Ship,
        planet: Planet,
        player: Player,
    },
    ShipUndocked {
        ship: Ship,
        planet: Planet,
        player: Player,
    },
    ShipSpawned {
        ship: Ship,
        player: Player,
    },
    RoomJoined {
        personal: bool,
        mode: GameMode,
        player: Player,
    },
    ShipDied {
        ship: Ship,
        player: Player,
    },
    GameEnded,
    GameStarted,
    CargoQuestTriggerRequest {
        player: Player,
    },
    TradeTriggerRequest {
        player: Player,
        planet_id: Uuid,
    },
    DialogueTriggerRequest {
        dialogue_name: String,
        player: Player,
    },
    // primarily needed for QuitDialogue effect, where we cannot force-quit
    // the player directly
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, )]
pub struct Ship {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub hp: f64,
    pub hp_effects: Vec<HpEffect>,
    pub max_hp: f64,
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
}

impl Ship {
    pub fn set_from(&mut self, pos: &Vec2f64) {
        self.x = pos.x;
        self.y = pos.y;
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TypescriptDefinition, TypeScriptify)]
pub enum CargoDeliveryQuestState {
    Unknown = 0,
    Started = 1,
    Picked = 2,
    Delivered = 3,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Quest {
    pub id: Uuid,
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub state: CargoDeliveryQuestState,
    pub reward: i32,
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
}

impl Player {
    pub fn set_quest(&mut self, q: Option<Quest>) {
        self.quest = q;
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Leaderboard {
    pub rating: Vec<(Player, u32)>,
    pub winner: String,
}

#[derive(Serialize, Deserialize, Debug, Clone,  TypescriptDefinition, TypeScriptify,)]
pub enum Rarity {
    Unknown,
    Common,
    Uncommon,
    Rare,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, )]
pub struct NatSpawnMineral {
    pub x: f64,
    pub y: f64,
    pub id: Uuid,
    pub radius: f64,
    pub value: i32,
    pub rarity: Rarity,
    pub color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameState {
    pub id: Uuid,
    pub version: u32,
    pub mode: GameMode,
    pub tag: Option<String>,
    pub seed: String,
    pub my_id: Uuid,
    pub start_time_ticks: u64,
    pub star: Option<Star>,
    pub planets: Vec<Planet>,
    pub asteroids: Vec<Asteroid>,
    pub minerals: Vec<NatSpawnMineral>,
    pub asteroid_belts: Vec<AsteroidBelt>,
    pub ships: Vec<Ship>,
    pub players: Vec<Player>,
    pub milliseconds_remaining: i32,
    pub paused: bool,
    pub leaderboard: Option<Leaderboard>,
    pub ticks: u32,
    pub disable_hp_effects: bool,
    pub market: Market,
}

// b84413729214a182 - no inner planet, lol
const FIXED_SEED: Option<&str> = None;

pub fn seed_state(_debug: bool, seed_and_validate: bool) -> GameState {
    let seed: String = if let Some(seed) = FIXED_SEED {
        String::from(seed)
    } else {
        random_hex_seed()
    };
    let mut state = gen_state_by_seed(seed_and_validate, seed);
    init_all_planets_market(&mut state);
    state
}

pub fn random_hex_seed() -> String {
    let mut rng = thread_rng();
    let mut bytes: [u8; 8] = [0; 8];
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub fn gen_state_by_seed(seed_and_validate: bool, seed: String) -> GameState {
    let state = system_gen(seed);

    let state = if seed_and_validate {
        let mut state = validate_state(state);
        let (planets, _sampler) = planet_movement::update_planets(&state.planets, &state.star, SEED_TIME, Sampler::empty(), AABB::maxed());
        state.planets = planets;
        let state = validate_state(state);
        state
    } else {
        state
    };
    state
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
            id: new_id(),
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

fn validate_state(mut in_state: GameState) -> GameState {
    in_state.planets = in_state
        .planets
        .into_iter()
        .filter(|p| {
            let p_pos = Vec2f64 { x: p.x, y: p.y };
            let check = p.x.is_finite()
                && !p.x.is_nan()
                && p.y.is_finite()
                && !p.y.is_nan()
                && p.rotation.is_finite()
                && !p.rotation.is_nan()
                && p_pos.euclidean_len() < MAX_ORBIT;

            if !check {
                eprintln!("Validate state: removed planet {:?})", p);
            }
            return check;
        })
        .collect::<Vec<_>>();
    in_state
}

pub fn force_update_to_now(state: &mut GameState) {
    let now = Utc::now().timestamp_millis() as u64;
    state.ticks = (now - state.start_time_ticks) as u32;
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct AABB {
    pub(crate) top_left: Vec2f64,
    pub(crate) bottom_right: Vec2f64,
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
        return self.top_left.x <= x && x <= self.bottom_right.x && self.top_left.y <= y && y <= self.bottom_right.y;
    }
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub struct UpdateOptions {
    pub disable_hp_effects: bool,
    pub limit_area: AABB,
}

// first group is in area, second is not
pub fn split_bodies_by_area(bodies: Vec<Box<dyn IBody>>, area: AABB) -> (Vec<Box<dyn IBody>>, Vec<Box<dyn IBody>>) {
    let anchors = build_anchors_from_bodies(bodies.clone());

    let res: (Vec<_>, Vec<_>) = bodies.into_iter().partition_map(|b| {
        if area.contains_body(&b) {
            Either::Left(b)
        } else {
            Either::Right(b)
        }
    });

    let (mut picked, mut dropped) = res;
    let mut already_picked_ids: HashSet<Uuid> = HashSet::from_iter(picked.iter().map(|p| p.get_id()));
    let anchors_vec = picked.iter().filter_map(|p| anchors.get(&p.get_anchor_id()).and_then(|p| {
        if !already_picked_ids.contains(&p.get_id()) {
            already_picked_ids.insert(p.get_id());
            Some(p.clone())
        } else {
            None
        }
    })).collect::<Vec<_>>();
    let anchor_ids: HashSet<Uuid> = HashSet::from_iter(anchors_vec.iter().map(|a| a.get_id()));
    picked.append(&mut anchors_vec.clone());
    dropped = dropped.into_iter().filter(|p| !anchor_ids.contains(&p.get_id())).collect::<Vec<_>>();
    return (picked, dropped);
}

pub fn update_world(
    mut state: GameState,
    elapsed: i64,
    client: bool,
    sampler: Sampler,
    update_options: UpdateOptions,
) -> (GameState, Sampler) {
    state.ticks += elapsed as u32 / 1000;
    if !client && state.seed != "tutorial".to_owned() {
        state.milliseconds_remaining -= elapsed as i32 / 1000;
    }

    let mut sampler = sampler;
    if state.paused {
        if !client {
            if state.milliseconds_remaining <= 500 {
                eprintln!("resetting game");
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
                state = seed_state(false, true);
                state.players = players.clone();
                for player in players.iter() {
                    spawn_ship(&mut state, player.id, None);
                }
                fire_event(GameEvent::GameStarted);
            } else {}
        }
    } else {
        if !client {
            state.leaderboard = sampler.measure(&|| make_leaderboard(&state.players), 8);

            if state.market.time_before_next_shake > 0 {
                state.market.time_before_next_shake -= elapsed;
            } else {
                let mut wares = state.market.wares.clone();
                let mut prices = state.market.prices.clone();
                let planets = state.planets.iter().map(|p| p.clone()).collect::<Vec<_>>();
                market::shake_market(planets, &mut wares, &mut prices);
                state.market = Market {
                    wares,
                    prices,
                    time_before_next_shake: market::SHAKE_MARKET_FREQUENCY_MCS,
                }
            }
        }
        if state.milliseconds_remaining <= 0 {
            eprintln!("game end");
            state.paused = true;
            state.milliseconds_remaining = 10 * 1000;
            fire_event(GameEvent::GameEnded);
        } else {
            let update_planets_id = sampler.start(9);
            let (planets, sampler_out) = planet_movement::update_planets(&state.planets, &state.star, elapsed, sampler, update_options.limit_area);
            state.planets = planets;
            sampler = sampler_out;

            sampler.end(update_planets_id);
            let update_ast_id = sampler.start(10);
            state.asteroids =
                planet_movement::update_asteroids(&state.asteroids, &state.star, elapsed);
            for mut belt in state.asteroid_belts.iter_mut() {
                belt.rotation += belt.orbit_speed / 1000.0 / 1000.0 * elapsed as f64;
            }
            sampler.end(update_ast_id);
            state.ships = sampler.measure(
                &|| update_ships_on_planets(&state.planets, &state.ships),
                11,
            );
            state.ships = sampler.measure(
                &|| {
                    update_ships_navigation(
                        &state.ships,
                        &state.planets,
                        &state.players,
                        &state.star,
                        elapsed,
                    )
                },
                12,
            );
            state.ships = sampler.measure(
                &|| update_ships_tractoring(&state.ships, &state.minerals),
                13,
            );

            let update_minerals_id = sampler.start(14);
            let (minerals, players_update) =
                update_tractored_minerals(&state.ships, &state.minerals, elapsed, &state.players);
            state.minerals = minerals;
            for pup in players_update {
                let pair = find_player_and_ship_mut(&mut state, pup.0);
                if let Some(ship) = pair.1 {
                    add_item(&mut ship.inventory, InventoryItem::from_mineral(pup.1));
                }
            }
            sampler.end(update_minerals_id);

            if !client && !update_options.disable_hp_effects && !state.disable_hp_effects {
                let hp_effects_id = sampler.start(15);
                state.ships = update_ship_hp_effects(
                    &state.star,
                    &state.ships,
                    &mut state.players,
                    elapsed,
                    state.ticks,
                );
                sampler.end(hp_effects_id);

                state.minerals = sampler.measure(
                    &|| update_state_minerals(&state.minerals, &state.asteroid_belts),
                    16,
                );
                let respawn_id = sampler.start(17);
                respawn_dead_ships(&mut state, elapsed);
                sampler.end(respawn_id);
            }
        };
    };
    (state, sampler)
}

fn update_ships_tractoring(ships: &Vec<Ship>, minerals: &Vec<NatSpawnMineral>) -> Vec<Ship> {
    ships
        .iter()
        .map(|s| {
            let mut s = s.clone();
            if let Some(target) = s.tractor_target {
                update_ship_tractor(target, &mut s, minerals);
            }
            s
        })
        .collect::<Vec<_>>()
}

const TRACTOR_SPEED_PER_SEC: f64 = 10.0;
const TRACTOR_PICKUP_DIST: f64 = 1.0;

fn update_tractored_minerals(
    ships: &Vec<Ship>,
    minerals: &Vec<NatSpawnMineral>,
    elapsed: i64,
    players: &Vec<Player>,
) -> (Vec<NatSpawnMineral>, Vec<(PlayerId, NatSpawnMineral)>) {
    let ship_by_tractor = index_ships_by_tractor_target(ships);
    let players_by_ship_id = index_players_by_ship_id(players);
    let mut players_update = vec![];
    let minerals = minerals
        .iter()
        .map(|m| {
            let mut m = m.clone();
            return if let Some(ships) = ship_by_tractor.get(&m.id) {
                let min_pos = Vec2f64 { x: m.x, y: m.y };
                let mut is_consumed = false;
                for ship in ships {
                    let dist = Vec2f64 {
                        x: ship.x,
                        y: ship.y,
                    }
                        .subtract(&min_pos);
                    let dir = dist.normalize();
                    if dist.euclidean_len() < TRACTOR_PICKUP_DIST {
                        if let Some(p) = players_by_ship_id.get(&ship.id) {
                            players_update.push((p.id, m.clone()))
                        }
                        is_consumed = true;
                    } else {
                        let scaled = dir
                            .scalar_mul(TRACTOR_SPEED_PER_SEC * elapsed as f64 / 1000.0 / 1000.0);
                        m.x += scaled.x;
                        m.y += scaled.y;
                    }
                }
                if is_consumed {
                    None
                } else {
                    Some(m)
                }
            } else {
                Some(m)
            };
        })
        .filter_map(|m| m)
        .collect::<Vec<_>>();
    (minerals, players_update)
}

const MAX_NAT_SPAWN_MINERALS: u32 = 10;

fn update_state_minerals(
    existing: &Vec<NatSpawnMineral>,
    belts: &Vec<AsteroidBelt>,
) -> Vec<NatSpawnMineral> {
    let mut res = existing.clone();
    if belts.len() > 0 {
        loop {
            if res.len() as u32 >= MAX_NAT_SPAWN_MINERALS {
                break;
            }
            res.push(seed_mineral(belts));
        }
    }
    res
}

fn seed_mineral(belts: &Vec<AsteroidBelt>) -> NatSpawnMineral {
    let mut rng = thread_rng();
    let mut small_rng = SmallRng::seed_from_u64(rng.next_u64());
    let picked = small_rng.gen_range(0, belts.len());
    let belt = &belts[picked];
    let pos_in_belt = gen_pos_in_belt(belt);
    let mineral_props = gen_mineral_props(&mut small_rng);
    NatSpawnMineral {
        x: pos_in_belt.x,
        y: pos_in_belt.y,
        id: new_id(),
        radius: mineral_props.0,
        value: mineral_props.1,
        rarity: mineral_props.3,
        color: mineral_props.2,
    }
}

fn gen_pos_in_belt(belt: &AsteroidBelt) -> Vec2f64 {
    let mut rng = thread_rng();
    let range = rng.gen_range(
        belt.radius - belt.width / 2.0,
        belt.radius + belt.width / 2.0,
    );
    let angle_rad = rng.gen_range(0.0, PI * 2.0);
    let x = angle_rad.cos() * range;
    let y = angle_rad.sin() * range;
    Vec2f64 { x, y }
}

fn respawn_dead_ships(mut state: &mut GameState, elapsed: i64) {
    for mut player in state.players.iter_mut() {
        if player.respawn_ms_left > 0 {
            player.respawn_ms_left -= (elapsed / 1000) as i32;
        }
    }

    let players_to_spawn = state
        .players
        .iter()
        .filter(|p| p.respawn_ms_left <= 0 && p.ship_id.is_none())
        .map(|p| p.id)
        .collect::<Vec<_>>();

    for pid in players_to_spawn {
        eprintln!("Respawning {}", pid);
        spawn_ship(&mut state, pid, None);
    }
}

const SHIP_REGEN_PER_SEC: f64 = 5.0;
const STAR_INSIDE_DAMAGE_PER_SEC: f64 = 50.0;
const STAR_DAMAGE_PER_SEC_NEAR: f64 = 25.0;
const STAR_DAMAGE_PER_SEC_FAR: f64 = 7.5;
const STAR_INSIDE_RADIUS: f64 = 0.5;
const STAR_CLOSE_RADIUS: f64 = 0.68;
const STAR_FAR_RADIUS: f64 = 1.1;
const MAX_HP_EFF_LIFE_MS: i32 = 10 * 1000;
const DMG_EFFECT_MIN: f64 = 5.0;
const HEAL_EFFECT_MIN: f64 = 5.0;
const PLAYER_RESPAWN_TIME_MS: i32 = 10 * 1000;

pub fn update_ship_hp_effects(
    star: &Option<Star>,
    ships: &Vec<Ship>,
    players: &mut Vec<Player>,
    elapsed_micro: i64,
    current_tick: u32,
) -> Vec<Ship> {
    let mut ships = ships.clone();
    if let Some(star) = star {
        let star_center = Vec2f64 {
            x: star.x,
            y: star.y,
        };
        for mut ship in ships.iter_mut() {
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
                ship.hp = (ship.hp - dmg_done as f64).max(0.0);
                ship.hp_effects.push(HpEffect {
                    id: new_id(),
                    hp: -dmg_done,
                    tick: current_tick,
                });
            }

            if star_damage <= 0.0 && ship.hp < ship.max_hp {
                let regen = SHIP_REGEN_PER_SEC * elapsed_micro as f64 / 1000.0 / 1000.0;
                ship.acc_periodic_heal += regen;
            }

            if ship.acc_periodic_heal >= HEAL_EFFECT_MIN {
                let heal = ship.acc_periodic_heal.floor() as i32;
                ship.acc_periodic_heal = 0.0;
                ship.hp = ship.max_hp.min(ship.hp + heal as f64);
                ship.hp_effects.push(HpEffect {
                    id: new_id(),
                    hp: heal as i32,
                    tick: current_tick,
                });
            }

            ship.hp_effects = ship
                .hp_effects
                .iter()
                .filter(|e| (e.tick as i32 - current_tick as i32).abs() < MAX_HP_EFF_LIFE_MS)
                .map(|e| e.clone())
                .collect::<Vec<_>>()
        }
    }

    let mut players_by_ship_id = index_players_by_ship_id_mut(players);
    ships
        .iter()
        .filter_map(|s| {
            if s.hp > 0.0 {
                Some(s.clone())
            } else {
                let player_opt = players_by_ship_id.get_mut(&s.id);
                if player_opt.is_some() {
                    let player_mut = player_opt.unwrap();
                    player_mut.ship_id = None;
                    player_mut.respawn_ms_left = PLAYER_RESPAWN_TIME_MS;
                    fire_event(GameEvent::ShipDied {
                        ship: s.clone(),
                        player: player_mut.clone(),
                    });
                    player_mut.money -= 1000;
                    player_mut.money = player_mut.money.max(0);
                }
                None
            }
        })
        .collect::<Vec<_>>()
}

pub fn add_player(state: &mut GameState, player_id: Uuid, is_bot: bool, name: Option<String>) {
    let player = Player {
        id: player_id.clone(),
        is_bot,
        ship_id: None,
        name: name.unwrap_or(player_id.to_string()),
        quest: None,
        portrait_name: "question".to_string(),
        money: 0,
        respawn_ms_left: 0,
    };
    state.players.push(player);
}

pub fn remove_player_ship(state: &mut GameState, player_id: Uuid) {
    let ship = find_my_ship(state, player_id);
    if let Some(ship) = ship {
        state.ships = state.ships.iter().filter_map(|s| {
            if s.id != ship.id {
                Some(s.clone())
            } else {
                None
            }
        }).collect::<Vec<_>>();
    }
}

pub fn spawn_ship(state: &mut GameState, player_id: Uuid, at: Option<Vec2f64>) -> &Ship {
    let mut rng = thread_rng();
    let mut small_rng = SmallRng::seed_from_u64(rng.next_u64());
    let rand_planet = get_random_planet(&state.planets, None, &mut rng);
    let mut at = at;
    if rand_planet.is_some() && at.is_none() {
        let p = rand_planet.unwrap();
        at = Some(Vec2f64 {
            x: p.x.clone(),
            y: p.y.clone(),
        })
    }
    let ship = Ship {
        id: crate::new_id(),
        color: gen_color(&mut small_rng).to_string(),
        x: if at.is_some() {
            at.unwrap().x
        } else {
            100.0
        },
        y: if at.is_some() {
            at.unwrap().y
        } else {
            100.0
        },
        hp: 100.0,
        hp_effects: vec![],
        max_hp: 100.0,
        acc_periodic_dmg: 0.0,
        acc_periodic_heal: 0.0,
        rotation: 0.0,
        radius: 1.0,
        docked_at: None,
        tractor_target: None,
        navigate_target: None,
        dock_target: None,
        trajectory: vec![],
        inventory: vec![],
    };
    state
        .players
        .iter_mut()
        .find(|p| p.id == player_id)
        .map(|p| {
            p.ship_id = Some(ship.id);
            fire_event(GameEvent::ShipSpawned {
                ship: ship.clone(),
                player: p.clone(),
            });
        });
    state.ships.push(ship);
    &state.ships[state.ships.len() - 1]
}

pub fn update_ships_navigation(
    ships: &Vec<Ship>,
    planets: &Vec<Planet>,
    players: &Vec<Player>,
    star: &Option<Star>,
    elapsed_micro: i64,
) -> Vec<Ship> {
    let mut res = vec![];
    let planets_with_star = make_bodies_from_planets(&planets, star);
    let bodies_by_id = index_bodies_by_id(planets_with_star);
    let players_by_ship_id = index_players_by_ship_id(players);
    for mut ship in ships.clone() {
        let player = players_by_ship_id.get(&ship.id);
        if player.is_none() {
            eprintln!("Cannot update ship {} without owner", ship.id);
            continue;
        }
        let player = player.unwrap();
        if !ship.docked_at.is_some() {
            let max_shift = SHIP_SPEED * elapsed_micro as f64 / 1000.0 / 1000.0;

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
                    ship.trajectory = build_trajectory_to_point(ship_pos, &target);
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
                    let planet_pos = Vec2f64 {
                        x: planet.get_x(),
                        y: planet.get_y(),
                    };
                    let planet_anchor = bodies_by_id.get(&planet.get_anchor_id()).unwrap();
                    ship.trajectory = build_trajectory_to_body(ship_pos, &planet, planet_anchor);
                    if let Some(first) = ship.trajectory.clone().get(0) {
                        let dir = first.subtract(&ship_pos);
                        ship.rotation = dir.angle_rad(&Vec2f64 { x: 0.0, y: -1.0 });
                        if dir.x < 0.0 {
                            ship.rotation = -ship.rotation;
                        }
                        let new_pos = move_ship(first, &ship_pos, max_shift);
                        ship.set_from(&new_pos);
                        if new_pos.euclidean_distance(&planet_pos) < planet.get_radius() {
                            ship.docked_at = Some(planet.get_id());
                            ship.dock_target = None;
                            ship.trajectory = vec![];
                            let planet = planet.clone().clone();
                            let player = player.clone().clone();
                            fire_event(GameEvent::ShipDocked {
                                ship: ship.clone(),
                                planet: Planet::from(planet),
                                player,
                            });
                        }
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
) -> Vec<Vec2f64> {
    // let start = Utc::now();
    let mut anchors = planet_movement::build_anchors_from_bodies(vec![to.clone(), to_anchor.clone()]);
    let mut shifts = HashMap::new();
    let mut counter = 0;
    let mut current_target = Planet::from(to.clone());
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift = TRAJECTORY_STEP_MICRO as f64 / 1000.0 / 1000.0 * SHIP_SPEED;
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

pub fn build_trajectory_to_point(from: Vec2f64, to: &Vec2f64) -> Vec<Vec2f64> {
    let mut counter = 0;
    let current_target = to.clone();
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift = TRAJECTORY_STEP_MICRO as f64 / 1000.0 / 1000.0 * SHIP_SPEED;
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

pub fn find_my_ship(state: &GameState, player_id: Uuid) -> Option<&Ship> {
    let player = find_my_player(state, player_id);
    if let Some(player) = player {
        if let Some(ship_id) = player.ship_id {
            return state.ships.iter().find(|ship| ship.id == ship_id);
        }
    }
    return None;
}

pub fn find_mineral(state: &GameState, min_id: Uuid) -> Option<&NatSpawnMineral> {
    return state.minerals.iter().find(|mineral| mineral.id == min_id);
}

pub fn find_mineral_m(minerals: &Vec<NatSpawnMineral>, min_id: Uuid) -> Option<&NatSpawnMineral> {
    return minerals.iter().find(|mineral| mineral.id == min_id);
}

pub fn find_my_ship_index(state: &GameState, player_id: Uuid) -> Option<usize> {
    let player = find_my_player(state, player_id);
    if let Some(player) = player {
        if let Some(ship_id) = player.ship_id {
            return state.ships.iter().position(|ship| ship.id == ship_id);
        }
    }
    return None;
}

pub fn find_planet<'a, 'b>(state: &'a GameState, planet_id: &'b Uuid) -> Option<&'a Planet> {
    return state.planets.iter().find(|p| p.id == *planet_id);
}

pub fn find_my_ship_mut(state: &mut GameState, player_id: Uuid) -> Option<&mut Ship> {
    let player = find_my_player(state, player_id);
    if let Some(player) = player {
        if let Some(ship_id) = player.ship_id {
            let index = state.ships.iter().position(|ship| ship.id == ship_id);
            if let Some(index) = index {
                return Some(&mut state.ships[index]);
            }
        }
    }
    return None;
}

pub fn find_my_player(state: &GameState, player_id: Uuid) -> Option<&Player> {
    state.players.iter().find(|p| p.id == player_id)
}

pub fn find_my_player_mut(state: &mut GameState, player_id: Uuid) -> Option<&mut Player> {
    let index = state
        .players
        .iter()
        .position(|player| player.id == player_id);
    if let Some(index) = index {
        let val: Option<&mut Player> = Some(&mut state.players[index]);
        return val;
    }
    return None;
}

pub fn find_player_and_ship_mut(state: &mut GameState, player_id: Uuid) -> (Option<&mut Player>, Option<&mut Ship>) {
    let index = state
        .players
        .iter()
        .position(|player| player.id == player_id);
    let mut player = None;
    let mut ship = None;
    if let Some(index) = index {
        let found_player = &mut state.players[index];
        if let Some(ship_id) = found_player.ship_id {
            let index = state.ships.iter().position(|ship| ship.id == ship_id);
            if let Some(index) = index {
                ship = Some(&mut state.ships[index]);
            }
        }

        player = Some(found_player);
    }
    return (player, ship);
}

pub fn find_player_and_ship(state: &GameState, player_id: Uuid) -> (Option<&Player>, Option<&Ship>) {
    let index = state
        .players
        .iter()
        .position(|player| player.id == player_id);
    let mut player = None;
    let mut ship = None;
    if let Some(index) = index {
        let found_player = &state.players[index];
        if let Some(ship_id) = found_player.ship_id {
            let index = state.ships.iter().position(|ship| ship.id == ship_id);
            if let Some(index) = index {
                ship = Some(&state.ships[index]);
            }
        }

        player = Some(found_player);
    }
    return (player, ship);
}

fn parse_ship_action(action_raw: ShipAction) -> ShipActionRust {
    match action_raw.s_type {
        ShipActionType::Unknown => ShipActionRust::Unknown,
        ShipActionType::Move => serde_json::from_str::<ManualMoveUpdate>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Move(v)),
        ShipActionType::Dock => ShipActionRust::Dock,
        ShipActionType::Navigate => serde_json::from_str::<Vec2f64>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Navigate(v)),
        ShipActionType::DockNavigate => serde_json::from_str::<Uuid>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::DockNavigate(v)),
        ShipActionType::Tractor => serde_json::from_str::<Uuid>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Tractor(v)),
    }
}

const MAX_TRACTOR_DIST: f64 = 30.0;

pub fn apply_ship_action(
    ship_action: ShipAction,
    state: &GameState,
    player_id: Uuid,
) -> Option<Ship> {
    let ship_action: ShipActionRust = parse_ship_action(ship_action);
    let old_ship = find_my_ship(state, player_id);

    if old_ship.is_none() {
        warn!("No ship");
        return None;
    }

    let old_ship = old_ship.unwrap();

    match ship_action {
        ShipActionRust::Unknown => {
            warn!("Unknown ship action");
            None
        }
        ShipActionRust::Move(v) => {
            let mut ship = old_ship.clone();
            ship.x = v.position.x;
            ship.y = v.position.y;
            ship.rotation = v.rotation;
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        ShipActionRust::Dock => {
            let mut ship = old_ship.clone();
            ship.navigate_target = None;
            ship.dock_target = None;
            if ship.docked_at.is_some() {
                let planet_id = ship.docked_at.unwrap();
                let planet = find_planet(state, &planet_id).unwrap().clone();
                let player = find_my_player(state, player_id).unwrap().clone();
                ship.docked_at = None;
                fire_event(GameEvent::ShipUndocked {
                    ship: ship.clone(),
                    planet,
                    player,
                });
            } else {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                for planet in state.planets.iter() {
                    let pos = Vec2f64 {
                        x: planet.x,
                        y: planet.y,
                    };
                    if pos.euclidean_distance(&ship_pos) < planet.radius {
                        ship.docked_at = Some(planet.id);
                        ship.x = planet.x;
                        ship.y = planet.y;
                        ship.navigate_target = None;
                        ship.dock_target = None;
                        ship.trajectory = vec![];
                        let player = find_my_player(state, player_id).unwrap().clone();

                        fire_event(GameEvent::ShipDocked {
                            ship: ship.clone(),
                            player,
                            planet: planet.clone(),
                        });
                        break;
                    }
                }
            }
            Some(ship)
        }
        ShipActionRust::Navigate(v) => {
            let mut ship = old_ship.clone();
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };

            ship.navigate_target = None;
            ship.dock_target = None;
            ship.docked_at = None;
            ship.navigate_target = Some(v);
            ship.trajectory = build_trajectory_to_point(ship_pos, &v);
            Some(ship)
        }
        ShipActionRust::DockNavigate(t) => {
            let mut ship = old_ship.clone();
            if let Some(planet) = find_planet(state, &t) {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let planet_pos = Vec2f64 {
                    x: planet.x,
                    y: planet.y,
                };
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.docked_at = None;
                ship.dock_target = Some(t);
                ship.trajectory = build_trajectory_to_point(ship_pos, &planet_pos);
                Some(ship)
            } else {
                None
            }
        }
        ShipActionRust::Tractor(t) => {
            let mut ship = old_ship.clone();
            update_ship_tractor(t, &mut ship, &state.minerals);
            Some(ship)
        }
    }
}

fn update_ship_tractor(t: Uuid, ship: &mut Ship, vec1: &Vec<NatSpawnMineral>) {
    if let Some(mineral) = find_mineral_m(&vec1, t) {
        let dist = Vec2f64 {
            x: ship.x,
            y: ship.y,
        }
            .euclidean_distance(&Vec2f64 {
                x: mineral.x,
                y: mineral.y,
            });
        if dist <= MAX_TRACTOR_DIST {
            ship.tractor_target = Some(t);
        } else {
            ship.tractor_target = None;
        }
    } else {
        ship.tractor_target = None;
    }
}

pub fn update_quests(state: &mut GameState) {
    let state_read = state.clone();
    let player_ids = state.players.iter().map(|p| p.id).collect::<Vec<_>>();
    for player_id in player_ids {
        if let (Some(mut player), Some(ship)) = find_player_and_ship_mut(state, player_id) {
            if player.quest.is_none() {
                player.quest = generate_random_quest(&state_read.planets, ship.docked_at);
            } else {
                let quest_id = player.quest.as_ref().map(|q| q.id).unwrap();
                if !has_quest_item(&ship.inventory, quest_id) && player.quest.as_ref().unwrap().state == CargoDeliveryQuestState::Picked {
                    player.quest = None;
                    log!(format!("Player {} has failed quest {} due to not having item", player_id, quest_id));
                }
            }
        }
    }
}

pub fn remove_player_from_state(conn_id: Uuid, state: &mut GameState) {
    state
        .players
        .iter()
        .position(|p| p.id == conn_id)
        .map(|i| {
            let player = state.players.remove(i);
            player.ship_id.map(|player_ship_id| {
                state
                    .ships
                    .iter()
                    .position(|s| s.id == player_ship_id)
                    .map(|i| state.ships.remove(i))
            })
        });
}

pub fn try_replace_ship(state: &mut GameState, updated_ship: &Ship, player_id: Uuid) -> bool {
    let old_ship_index = find_my_ship_index(&state, player_id);
    return if let Some(old_ship_index) = old_ship_index {
        state.ships.remove(old_ship_index);
        state.ships.push(updated_ship.clone());
        true
    } else {
        eprintln!("couldn't replace ship");
        false
    };
}

pub fn mutate_ship_no_lock(
    client_id: Uuid,
    mutate_cmd: ShipAction,
    state: &mut GameState,
) -> Option<Ship> {
    let old_ship_index = find_my_ship_index(&state, client_id);
    if old_ship_index.is_none() {
        warn!("No old instance of ship");
        return None;
    }
    force_update_to_now(state);
    let updated_ship = apply_ship_action(mutate_cmd, &state, client_id);
    if let Some(updated_ship) = updated_ship {
        let replaced = try_replace_ship(state, &updated_ship, client_id);
        if replaced {
            return Some(updated_ship);
        }
        warn!("Couldn't replace ship");
        return None;
    }
    force_update_to_now(state);
    warn!("Ship update was invalid");
    return None;
}
