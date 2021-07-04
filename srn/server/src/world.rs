use std::borrow::{Borrow, BorrowMut};
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;
#[allow(deprecated)]
use std::f64::{INFINITY, NEG_INFINITY};
use std::iter::FromIterator;

use chrono::Utc;
use itertools::{Either, Itertools};
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

use crate::abilities::Ability;
use crate::combat::ShootTarget;
use crate::indexing::{find_my_ship, find_my_ship_index, ObjectSpecifier};
use crate::inventory::{
    add_item, add_items, has_quest_item, shake_items, InventoryItem, InventoryItemType,
};
use crate::long_actions::{
    cancel_all_long_actions_of_type, finish_long_act, tick_long_act, try_start_long_action,
    LongAction, LongActionStart,
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
use crate::ship_action::{ShipActionRust, ShipMovement};
use crate::substitutions::substitute_notification_texts;
use crate::system_gen::{str_to_hash, system_gen};
use crate::tractoring::{
    ContainersContainer, IMovable, MineralsContainer, MovablesContainer, MovablesContainerBase,
};
use crate::vec2::{deg_to_rad, AsVec2f64, Precision, Vec2f64};
use crate::{abilities, autofocus, indexing};
use crate::{combat, fire_event, market, notifications, planet_movement, ship_action, tractoring};
use crate::{new_id, DEBUG_PHYSICS};

// speeds are per second
const SHIP_SPEED: f64 = 20.0;
const SHIP_TURN_SPEED_DEG: f64 = 90.0;
const ORB_SPEED_MULT: f64 = 1.0;
const SEED_TIME: i64 = 9321 * 1000 * 1000;
const MAX_ORBIT: f64 = 450.0;
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

pub fn generate_random_quest(
    player: &mut Player,
    planets: &Vec<Planet>,
    docked_at: Option<Uuid>,
    prng: &mut SmallRng,
) {
    if planets.len() <= 0 {
        return;
    }
    let from = get_random_planet(planets, docked_at, prng);
    if from.is_none() {
        return;
    }
    let from = from.unwrap();
    let delivery = planets
        .into_iter()
        .filter(|p| p.id != from.id)
        .collect::<Vec<_>>();
    let to = &delivery[prng.gen_range(0, delivery.len())];
    let reward = prng.gen_range(500, 1001);
    let quest = Quest {
        id: new_id(),
        from_id: from.id,
        to_id: to.id,
        state: CargoDeliveryQuestState::Started,
        reward,
    };
    player.quest = Some(quest);
    notifications::update_quest_notifications(player);
}

fn get_random_planet<'a>(
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

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Ship {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub hp: f64,
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
    #[serde(default)]
    pub abilities: Vec<Ability>,
    pub auto_focus: Option<ObjectSpecifier>,
    #[serde(default)]
    pub movement: ShipMovement,
}

impl Ship {
    pub fn new(mut small_rng: &mut SmallRng, at: &mut Option<Vec2f64>) -> Ship {
        Ship {
            id: crate::new_id(),
            color: gen_color(&mut small_rng).to_string(),
            x: if at.is_some() { at.unwrap().x } else { 100.0 },
            y: if at.is_some() { at.unwrap().y } else { 100.0 },
            hp: 100.0,
            max_hp: 100.0,
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
            abilities: vec![Ability::Shoot {
                cooldown_ticks_remaining: 0,
            }],
            auto_focus: None,
            movement: Default::default(),
        }
    }
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

impl Quest {
    pub fn as_notification(&self) -> Notification {
        let text = format!("You've been tasked with delivering a cargo from one planet to another. Here's what you need:\n\n1. Pick up the cargo at s_cargo_source_planet.\n2. Drop off the cargo at s_cargo_destination_planet.\n\nYour employer, who wished to remain anonymous, will reward you: {} SB", self.reward);
        Notification::Task {
            header: "Delivery quest".to_string(),
            text: NotificationText {
                text,
                substituted: false,
                substitutions: vec![],
            },
            id: new_id(),
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
    pub long_actions: Vec<LongAction>,
    pub local_effects: Vec<LocalEffect>,
    pub notifications: Vec<Notification>,
}

impl Player {
    pub fn new(id: Uuid, mode: &GameMode) -> Self {
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
            local_effects: vec![],
            notifications: get_new_player_notifications(mode),
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
    pub fn new() -> Self {
        Container {
            id: new_id(),
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
        let mut cont = Container::new();
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
pub struct Location {
    pub seed: String,
    pub id: Uuid,
    pub star: Option<Star>,
    pub planets: Vec<Planet>,
    pub asteroids: Vec<Asteroid>,
    pub minerals: Vec<NatSpawnMineral>,
    pub containers: Vec<Container>,
    pub position: Vec2f64,
    pub asteroid_belts: Vec<AsteroidBelt>,
    pub ships: Vec<Ship>,
    pub adjacent_location_ids: Vec<Uuid>,
}

impl Location {
    pub fn new_empty() -> Self {
        Location {
            seed: "".to_string(),
            id: new_id(),
            star: None,
            planets: vec![],
            asteroids: vec![],
            minerals: vec![],
            containers: vec![],
            position: Default::default(),
            asteroid_belts: vec![],
            ships: vec![],
            adjacent_location_ids: vec![],
        }
    }

    pub fn new_star_system() -> Location {
        Location {
            id: new_id(),
            adjacent_location_ids: vec![],
            seed: "empty".to_string(),
            star: None,
            planets: vec![],
            asteroids: vec![],
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
    pub ticks: u32,
    pub disable_hp_effects: bool,
    pub market: Market,
    pub locations: Vec<Location>,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            id: Default::default(),
            version: 0,
            mode: GameMode::Unknown,
            tag: None,
            seed: "".to_string(),
            my_id: Default::default(),
            start_time_ticks: 0,
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            ticks: 0,
            disable_hp_effects: false,
            market: Market {
                wares: Default::default(),
                prices: Default::default(),
                time_before_next_shake: 0,
            },
            locations: vec![],
        }
    }
}

// b84413729214a182 - no inner planet, lol
const FIXED_SEED: Option<&str> = None;

pub fn seed_state(_debug: bool, seed_and_validate: bool) -> GameState {
    let seed: String = if let Some(seed) = FIXED_SEED {
        String::from(seed)
    } else {
        random_hex_seed()
    };
    log!(format!("Starting seeding state with seed={}", seed));
    let mut state = gen_state_by_seed(seed_and_validate, seed);
    init_all_planets_market(&mut state);
    log!(format!("Done."));
    state
}

pub fn random_hex_seed() -> String {
    let mut rng = thread_rng();
    let mut bytes: [u8; 8] = [0; 8];
    rng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub fn random_hex_seed_seeded(prng: &mut SmallRng) -> String {
    let mut bytes: [u8; 8] = [0; 8];
    prng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub fn gen_state_by_seed(seed_and_validate: bool, seed: String) -> GameState {
    let state = system_gen(seed);

    let state = if seed_and_validate {
        let mut state = validate_state(state);
        for idx in 0..state.locations.len() {
            let (planets, _sampler) = planet_movement::update_planets(
                &state.locations[idx].planets,
                &state.locations[idx].star,
                SEED_TIME,
                Sampler::empty(),
                AABB::maxed(),
            );
            state.locations[idx].planets = planets;
        }
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

pub fn validate_state(mut in_state: GameState) -> GameState {
    for idx in 0..in_state.locations.len() {
        in_state.locations[idx].planets = extract_valid_planets(&in_state, idx);
    }
    in_state
}

pub fn extract_valid_planets(in_state: &GameState, location_idx: usize) -> Vec<Planet> {
    in_state.locations[location_idx]
        .planets
        .iter()
        .filter(|p| {
            let p_pos = Vec2f64 { x: p.x, y: p.y };
            let check = p.x.is_finite()
                && !p.x.is_nan()
                && p.y.is_finite()
                && !p.y.is_nan()
                && p.rotation.is_finite()
                && !p.rotation.is_nan()
                && p_pos.euclidean_len() < MAX_ORBIT;

            // if !check {
            //     eprintln!("Validate state: removed planet {:?})", p);
            // }
            return check;
        })
        .map(|p| p.clone())
        .collect::<Vec<_>>()
}

pub fn force_update_to_now(state: &mut GameState) {
    let now = Utc::now().timestamp_millis() as u64;
    state.ticks = (now - state.start_time_ticks) as u32;
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
            } else {
            }
        }
    } else {
        if !client {
            let update_leaderboard_id = sampler.start(SamplerMarks::UpdateLeaderboard as u32);
            state.leaderboard = make_leaderboard(&state.players);
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
                market::shake_market(planets, &mut wares, &mut prices);
                state.market = Market {
                    wares,
                    prices,
                    time_before_next_shake: market::SHAKE_MARKET_FREQUENCY_MCS,
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
                    let (new_la, keep_ticking) = tick_long_act(la, elapsed);
                    if !keep_ticking {
                        to_finish.push((new_la.clone(), player.id));
                    }
                    return if keep_ticking { Some(new_la) } else { None };
                })
                .collect();
        }
        if !client {
            for (act, player_id) in to_finish.into_iter() {
                finish_long_act(&mut state, player_id, act);
            }
        }

        sampler.end(long_act_ticks);

        if state.milliseconds_remaining <= 0 {
            eprintln!("game end");
            state.paused = true;
            state.milliseconds_remaining = 10 * 1000;
            fire_event(GameEvent::GameEnded);
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
                )
            }
        };
    };
    (state, sampler)
}

pub fn update_location(
    mut state: &mut GameState,
    elapsed: i64,
    client: bool,
    update_options: &UpdateOptions,
    mut sampler: Sampler,
    location_idx: usize,
) -> Sampler {
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
        &state.players,
        &state.locations[location_idx].star,
        elapsed,
        my_ship_id,
        client,
    );
    sampler.end(update_ships_navigation_id);

    let update_ship_manual_movement_id =
        sampler.start(SamplerMarks::UpdateShipsManualMovement as u32);
    update_ships_manual_movement(
        &mut state.locations[location_idx].ships,
        elapsed,
        state.ticks,
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
        let hp_effects_id = sampler.start(SamplerMarks::UpdateShipHpEffects as u32);
        state.locations[location_idx].ships = update_ship_hp_effects(
            &state.locations[location_idx].star,
            &state.locations[location_idx].ships,
            &mut state.players,
            elapsed,
            state.ticks,
        );
        sampler.end(hp_effects_id);

        let update_minerals_respawn_id = sampler.start(SamplerMarks::UpdateMineralsRespawn as u32);
        state.locations[location_idx].minerals = update_state_minerals(
            &state.locations[location_idx].minerals,
            &state.locations[location_idx].asteroid_belts,
        );
        sampler.end(update_minerals_respawn_id);
        let respawn_id = sampler.start(SamplerMarks::UpdateShipsRespawn as u32);
        update_ships_respawn(&mut state);
        sampler.end(respawn_id);
    }
    let autofocus_id = sampler.start(SamplerMarks::UpdateAutofocus as u32);
    autofocus::update_location_autofocus(location_idx, &mut state.locations[location_idx]);
    sampler.end(autofocus_id);

    sampler
}

// keep synced with world.ts
const MANUAL_MOVEMENT_INACTIVITY_DROP_MS: i32 = 500;

fn update_ships_manual_movement(ships: &mut Vec<Ship>, elapsed_micro: i64, current_tick: u32) {
    for ship in ships.iter_mut() {
        let (new_move, new_pos) = if let Some(params) = &mut ship.movement.gas {
            if (params.last_tick as i32 - current_tick as i32).abs()
                > MANUAL_MOVEMENT_INACTIVITY_DROP_MS
            {
                (None, None)
            } else {
                let sign = if params.forward { 1.0 } else { -1.0 };
                let distance = SHIP_SPEED * elapsed_micro as f64 / 1000.0 / 1000.0 * sign;
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
        ship.movement.gas = new_move;
        if let Some(new_pos) = new_pos {
            ship.set_from(&new_pos);
        }
        let (new_move, new_rotation) = if let Some(params) = &ship.movement.turn {
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
        ship.movement.turn = new_move;
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
        let ticks = state.ticks.clone();
        let pair = indexing::find_player_and_ship_mut(&mut state, pup.0);
        let picked_items = InventoryItem::from(pup.1);
        if let Some(player) = pair.0 {
            player.local_effects.push(LocalEffect::PickUp {
                id: new_id(),
                text: format!("Pick up: {}", InventoryItem::format(&picked_items)),
                position: Default::default(),
                tick: ticks,
            })
        }
        if let Some(ship) = pair.1 {
            add_items(&mut ship.inventory, picked_items);
        }
    }
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

pub fn spawn_mineral(location: &mut Location, rarity: Rarity, pos: Vec2f64) {
    let mut small_rng = gen_rng();
    let mut min = gen_mineral(&mut small_rng, pos);
    min.rarity = rarity;
    location.minerals.push(min)
}

pub fn spawn_container(loc: &mut Location, at: Vec2f64) {
    let mut prng = gen_rng();
    let mut container = Container::random(&mut prng);
    container.position = at;
    loc.containers.push(container);
}

fn seed_mineral(belts: &Vec<AsteroidBelt>) -> NatSpawnMineral {
    let mut small_rng = gen_rng();
    let picked = small_rng.gen_range(0, belts.len());
    let belt = &belts[picked];
    let pos_in_belt = gen_pos_in_belt(belt);
    gen_mineral(&mut small_rng, pos_in_belt)
}

pub fn gen_rng() -> SmallRng {
    SmallRng::seed_from_u64(thread_rng().next_u64())
}

fn gen_mineral(mut small_rng: &mut SmallRng, pos: Vec2f64) -> NatSpawnMineral {
    let mineral_props = gen_mineral_props(&mut small_rng);
    NatSpawnMineral {
        x: pos.x,
        y: pos.y,
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

fn update_ships_respawn(state: &mut GameState) {
    let mut to_spawn = vec![];
    for player in state.players.iter() {
        if player.ship_id.is_none() {
            if player.long_actions.len() > 5 {
                eprintln!("too long long actions {}", player.long_actions.len());
            }
            let respawns_in_progress = player
                .long_actions
                .iter()
                .any(|a| matches!(a, LongAction::Respawn { .. }));

            if !respawns_in_progress {
                to_spawn.push(player.id);
            }
        }
    }

    for player_id in to_spawn {
        try_start_long_action(state, player_id, LongActionStart::Respawn);
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
pub const PLAYER_RESPAWN_TIME_MC: i32 = 10 * 1000 * 1000;

pub fn update_ship_hp_effects(
    star: &Option<Star>,
    ships: &Vec<Ship>,
    players: &mut Vec<Player>,
    elapsed_micro: i64,
    current_tick: u32,
) -> Vec<Ship> {
    let mut ships = ships.clone();
    let mut players_by_ship_id = indexing::index_players_by_ship_id_mut(players);
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
                if let Some(player) = players_by_ship_id.get_mut(&ship.id) {
                    player.local_effects.push(LocalEffect::DmgDone {
                        id: new_id(),
                        hp: -dmg_done,
                        tick: current_tick,
                        ship_id: ship.id,
                    });
                }
            }

            if star_damage <= 0.0 && ship.hp < ship.max_hp {
                let regen = SHIP_REGEN_PER_SEC * elapsed_micro as f64 / 1000.0 / 1000.0;
                ship.acc_periodic_heal += regen;
            }

            if ship.acc_periodic_heal >= HEAL_EFFECT_MIN {
                let heal = ship.acc_periodic_heal.floor() as i32;
                ship.acc_periodic_heal = 0.0;
                ship.hp = ship.max_hp.min(ship.hp + heal as f64);
                if let Some(player) = players_by_ship_id.get_mut(&ship.id) {
                    player.local_effects.push(LocalEffect::Heal {
                        id: new_id(),
                        hp: heal as i32,
                        tick: current_tick,
                        ship_id: ship.id,
                    });
                }
            }

            if let Some(mut player) = players_by_ship_id.get_mut(&ship.id) {
                player.local_effects = player
                    .local_effects
                    .iter()
                    .filter(|e| {
                        if let Some(tick) = match &e {
                            LocalEffect::Unknown { .. } => None,
                            LocalEffect::DmgDone { tick, .. } => Some(tick),
                            LocalEffect::Heal { tick, .. } => Some(tick),
                            LocalEffect::PickUp { tick, .. } => Some(tick),
                        } {
                            return (*tick as i32 - current_tick as i32).abs()
                                < MAX_LOCAL_EFF_LIFE_MS;
                        }
                        return false;
                    })
                    .map(|e| e.clone())
                    .collect::<Vec<_>>()
            }
        }
    }

    ships
        .iter()
        .filter_map(|s| {
            if s.hp > 0.0 {
                Some(s.clone())
            } else {
                let player_opt = players_by_ship_id.get_mut(&s.id);
                if player_opt.is_some() {
                    apply_ship_death(s, player_opt.unwrap());
                }
                None
            }
        })
        .collect::<Vec<_>>()
}

fn apply_ship_death(s: &Ship, player_mut: &mut Player) {
    player_mut.ship_id = None;
    fire_event(GameEvent::ShipDied {
        ship: s.clone(),
        player: player_mut.clone(),
    });
    player_mut.money -= 1000;
    player_mut.money = player_mut.money.max(0);
    cancel_all_long_actions_of_type(
        &mut player_mut.long_actions,
        LongAction::TransSystemJump {
            id: Default::default(),
            to: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
    );
}

pub fn add_player(state: &mut GameState, player_id: Uuid, is_bot: bool, name: Option<String>) {
    let mut player = Player::new(player_id, &state.mode);
    player.is_bot = is_bot;
    player.name = name.unwrap_or(player_id.to_string());
    state.players.push(player);
}

pub fn spawn_ship(state: &mut GameState, player_id: Uuid, at: Option<Vec2f64>) -> &Ship {
    let mut small_rng = gen_rng();
    let rand_planet = get_random_planet(&state.locations[0].planets, None, &mut small_rng);
    let mut at = at;
    if rand_planet.is_some() && at.is_none() {
        let p = rand_planet.unwrap();
        at = Some(Vec2f64 {
            x: p.x.clone(),
            y: p.y.clone(),
        })
    }
    let ship = Ship::new(&mut small_rng, &mut at);
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
    state.locations[0].ships.push(ship);
    &state.locations[0].ships[state.locations[0].ships.len() - 1]
}

pub fn update_ships_navigation(
    ships: &Vec<Ship>,
    planets: &Vec<Planet>,
    players: &Vec<Player>,
    star: &Option<Star>,
    elapsed_micro: i64,
    _my_ship_id: Option<Uuid>,
    _client: bool,
) -> Vec<Ship> {
    let mut res = vec![];
    let planets_with_star = make_bodies_from_planets(&planets, star);
    let bodies_by_id = index_bodies_by_id(planets_with_star);
    let players_by_ship_id = indexing::index_players_by_ship_id(players);

    for mut ship in ships.clone() {
        // impossible to optimize yet, simply because the
        // movement by trajectory is coupled with trajectory building,
        // so this is required for smooth client movement of other ships
        // if client && ship.id != my_ship_id.unwrap_or(Uuid::default()) {
        //     res.push(ship);
        //     continue;
        // }
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
                            dock_ship(&mut ship, player, planet);
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

pub fn dock_ship(mut ship: &mut Ship, player: &Player, planet: &Box<dyn IBody>) {
    ship.docked_at = Some(planet.get_id());
    ship.dock_target = None;
    ship.x = planet.get_x();
    ship.y = planet.get_y();
    ship.trajectory = vec![];
    let planet = planet.clone().clone();
    let player = player.clone().clone();
    fire_event(GameEvent::ShipDocked {
        ship: ship.clone(),
        planet: Planet::from(planet),
        player,
    });
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
    let mut anchors =
        planet_movement::build_anchors_from_bodies(vec![to.clone(), to_anchor.clone()]);
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

pub struct ShipIdx {
    pub location_idx: usize,
    pub ship_idx: usize,
}

pub fn update_quests(state: &mut GameState, prng: &mut SmallRng) {
    let quest_planets = state.locations[0].planets.clone();
    let mut any_new_quests = false;
    let player_ids = state.players.iter().map(|p| p.id).collect::<Vec<_>>();
    for player_id in player_ids {
        if let (Some(mut player), Some(ship)) = indexing::find_player_and_ship_mut(state, player_id)
        {
            if player.quest.is_none() {
                generate_random_quest(player, &quest_planets, ship.docked_at, prng);
                any_new_quests = true;
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
    if any_new_quests {
        substitute_notification_texts(state, HashSet::new());
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

pub fn mutate_ship_no_lock(
    client_id: Uuid,
    mutate_cmd: ShipActionRust,
    state: &mut GameState,
) -> Option<(Ship, ShipIdx)> {
    let old_ship_index = indexing::find_my_ship_index(&state, client_id);
    if old_ship_index.is_none() {
        warn!("No old instance of ship");
        return None;
    }
    force_update_to_now(state);
    let updated_ship = ship_action::apply_ship_action(mutate_cmd, &state, client_id);
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
