use std::borrow::{Borrow, BorrowMut};
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;

use chrono::Utc;
use itertools::Itertools;
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;
use uuid::*;

use crate::dialogue::{
    build_dialogue_from_state, Dialogue, DialogueScript, DialogueStates, DialogueTable,
    DialogueUpdate,
};
use crate::planet_movement::{index_bodies_by_id, make_bodies, IBody};
use crate::random_stuff::{
    gen_color, gen_planet_count, gen_planet_gap, gen_planet_name, gen_planet_orbit_speed,
    gen_planet_radius, gen_random_photo_id, gen_sat_count, gen_sat_gap, gen_sat_name,
    gen_sat_orbit_speed, gen_sat_radius, gen_star_name, gen_star_radius,
};
use crate::vec2::{angle_rad, rotate, AsVec2f64, Precision, Vec2f64};
use crate::{dialogue, new_id, DEBUG_PHYSICS};
use crate::{fire_event, planet_movement};

const SHIP_SPEED: f64 = 20.0;
const ORB_SPEED_MULT: f64 = 1.0;
const SEED_TIME: i64 = 9321 * 1000 * 1000;
const MAX_ORBIT: f64 = 400.0;
const TRAJECTORY_STEP_MICRO: i64 = 250 * 1000;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;

pub type PlayerId = Uuid;

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShipActionType {
    Unknown = 0,
    Move = 1,
    Dock = 2,
    Navigate = 3,
    DockNavigate = 4,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShipAction {
    pub s_type: ShipActionType,
    pub data: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
    let from = get_random_planet(planets, docked_at, &mut rng);
    let delivery = planets
        .into_iter()
        .filter(|p| p.id != from.id)
        .collect::<Vec<_>>();
    let to = &delivery[rng.gen_range(0, delivery.len())];
    let reward = rng.gen_range(500, 1001);
    return Some(Quest {
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
) -> &'a Planet {
    let pickup = planets
        .into_iter()
        .filter(|p| p.id != docked_at.unwrap_or(Default::default()))
        .collect::<Vec<_>>();
    let from = &pickup[rng.gen_range(0, pickup.len())];
    from
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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

#[derive(Serialize, Deserialize, Debug, Clone)]
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

impl AsVec2f64 for Planet {
    fn as_vec(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
    ShipDied {
        ship: Ship,
        player: Player,
    },
    GameEnded,
    GameStarted,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
    pub navigate_target: Option<Vec2f64>,
    pub dock_target: Option<Uuid>,
    pub trajectory: Vec<Vec2f64>,
}

impl Ship {
    pub fn set_from(&mut self, pos: &Vec2f64) {
        self.x = pos.x;
        self.y = pos.y;
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CargoDeliveryQuestState {
    Unknown = 0,
    Started = 1,
    Picked = 2,
    Delivered = 3,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Quest {
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub state: CargoDeliveryQuestState,
    pub reward: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Leaderboard {
    pub rating: Vec<(Player, u32)>,
    pub winner: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameState {
    pub tag: Option<String>,
    pub my_id: Uuid,
    pub start_time_ticks: u64,
    pub star: Option<Star>,
    pub planets: Vec<Planet>,
    pub asteroids: Vec<Asteroid>,
    pub ships: Vec<Ship>,
    pub players: Vec<Player>,
    pub milliseconds_remaining: i32,
    pub paused: bool,
    pub leaderboard: Option<Leaderboard>,
    pub ticks: u32,
}

pub fn seed_state(debug: bool, seed_and_validate: bool) -> GameState {
    let star_id = crate::new_id();
    let star = Star {
        color: "rgb(200, 150, 65)".to_string(),
        id: star_id.clone(),
        name: gen_star_name().to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: gen_star_radius(),
    };

    let mut planets = vec![];

    let mut current_x = star.radius;
    let mut used_planet_names = HashSet::new();
    for i in 0..gen_planet_count() {
        let planet_id = new_id();
        let name = gen_planet_name().to_string();
        if used_planet_names.contains(&name) {
            continue;
        }
        used_planet_names.insert(name.clone());
        current_x += gen_planet_gap();
        let planet = Planet {
            id: planet_id,
            name,
            x: current_x.clone(),
            y: 0.0,
            rotation: 0.0,
            radius: gen_planet_radius(),
            orbit_speed: gen_planet_orbit_speed() * ORB_SPEED_MULT / (i + 1) as f64,
            anchor_id: star.id.clone(),
            anchor_tier: 1,
            color: gen_color().to_string(),
        };
        let mut current_sat_x = current_x + planet.radius + 10.0;
        for j in 0..gen_sat_count(planet.radius) {
            let name = gen_sat_name().to_string();
            if used_planet_names.contains(&name) {
                continue;
            }
            used_planet_names.insert(name.clone());
            current_sat_x += gen_sat_gap();
            planets.push(Planet {
                id: new_id(),
                name,
                x: current_sat_x,
                y: 0.0,
                rotation: 0.0,
                radius: gen_sat_radius(),
                orbit_speed: gen_sat_orbit_speed() * ORB_SPEED_MULT / (j + 1) as f64,
                anchor_id: planet_id,
                anchor_tier: 2,
                color: gen_color().to_string(),
            })
        }
        planets.push(planet);
    }

    let now = Utc::now().timestamp_millis() as u64;
    let state = GameState {
        tag: None,
        milliseconds_remaining: 3 * 60 * 1000,
        paused: false,
        my_id: crate::new_id(),
        ticks: 0,
        star: Some(star),
        planets,
        asteroids: vec![],
        ships: vec![],
        players: vec![],
        leaderboard: None,
        start_time_ticks: now,
    };
    let state = if seed_and_validate {
        let mut state = validate_state(state);
        state.planets = planet_movement::update_planets(&state.planets, &state.star, SEED_TIME);
        let state = validate_state(state);
        state
    } else {
        state
    };
    if debug {
        eprintln!("{}", serde_json::to_string_pretty(&state).ok().unwrap());
    }
    state
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

pub fn update_world(mut state: GameState, elapsed: i64, client: bool) -> GameState {
    state.ticks += elapsed as u32 / 1000;
    if !client {
        state.milliseconds_remaining -= elapsed as i32 / 1000;
    }

    if state.paused {
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
    } else {
        if !client {
            state.leaderboard = make_leaderboard(&state.players);
        }
        if state.milliseconds_remaining <= 0 {
            eprintln!("game end");
            state.paused = true;
            state.milliseconds_remaining = 10 * 1000;
            fire_event(GameEvent::GameEnded);
        } else {
            state.planets = planet_movement::update_planets(&state.planets, &state.star, elapsed);
            state.ships = update_ships_on_planets(&state.planets, &state.ships);
            state.ships = update_ships_navigation(
                &state.ships,
                &state.planets,
                &state.players,
                &state.star,
                elapsed,
            );
            if !client {
                state.ships = update_ship_hp_effects(
                    &state.star,
                    &state.ships,
                    &mut state.players,
                    elapsed,
                    state.ticks,
                );

                respawn_dead_ships(&mut state, elapsed)
            }
        }
    }
    state
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
                    })
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

pub fn spawn_ship(state: &mut GameState, player_id: Uuid, at: Option<Vec2f64>) -> &Ship {
    let mut rng: ThreadRng = rand::thread_rng();
    let start = get_random_planet(&state.planets, None, &mut rng);
    let ship = Ship {
        id: crate::new_id(),
        color: gen_color().to_string(),
        x: if at.is_some() {
            at.unwrap().x
        } else {
            start.x.clone()
        },
        y: if at.is_some() {
            at.unwrap().y
        } else {
            start.y.clone()
        },
        hp: 100.0,
        hp_effects: vec![],
        max_hp: 100.0,
        acc_periodic_dmg: 0.0,
        acc_periodic_heal: 0.0,
        rotation: 0.0,
        radius: 1.0,
        docked_at: None,
        navigate_target: None,
        dock_target: None,
        trajectory: vec![],
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
    let planets_with_star = make_bodies(&planets, star);
    let planets_by_id = index_bodies_by_id(planets_with_star);
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
                ship.rotation = angle_rad(dir, Vec2f64 { x: 0.0, y: -1.0 });
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
                if let Some(planet) = planets_by_id.get(&target) {
                    let planet = Planet::from(planet.clone());
                    let ship_pos = Vec2f64 {
                        x: ship.x,
                        y: ship.y,
                    };
                    let planet_pos = Vec2f64 {
                        x: planet.x,
                        y: planet.y,
                    };
                    ship.trajectory = build_trajectory_to_planet(ship_pos, &planet, &planets_by_id);
                    if let Some(first) = ship.trajectory.clone().get(0) {
                        let dir = first.subtract(&ship_pos);
                        ship.rotation = angle_rad(dir, Vec2f64 { x: 0.0, y: -1.0 });
                        if dir.x < 0.0 {
                            ship.rotation = -ship.rotation;
                        }
                        let new_pos = move_ship(first, &ship_pos, max_shift);
                        ship.set_from(&new_pos);
                        if new_pos.euclidean_distance(&planet_pos) < planet.radius {
                            ship.docked_at = Some(planet.id);
                            ship.dock_target = None;
                            ship.trajectory = vec![];
                            let planet = planet.clone().clone();
                            let player = player.clone().clone();
                            fire_event(GameEvent::ShipDocked {
                                ship: ship.clone(),
                                planet,
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
fn build_trajectory_to_planet(
    from: Vec2f64,
    to: &Planet,
    by_id: &HashMap<Uuid, Box<dyn IBody>>,
) -> Vec<Vec2f64> {
    // let start = Utc::now();
    let mut anchors = planet_movement::build_anchors_from_bodies(vec![Box::new(to.clone())], by_id);
    let mut shifts = HashMap::new();
    let mut counter = 0;
    let mut current_target = to.clone();
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
            counter >= TRAJECTORY_MAX_ITER || distance < to.radius / 2.0 + TRAJECTORY_EPS;
        if should_break {
            break;
        }
        current_from = move_ship(&current_target_pos, &current_from, max_shift);
        current_target = Planet::from(planet_movement::simulate_planet_movement(
            TRAJECTORY_STEP_MICRO,
            &mut anchors,
            &mut shifts,
            current_target.anchor_tier,
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
            let cond = p.euclidean_distance(&planet_pos) < to.radius;
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
    }
}

pub fn apply_ship_action(
    ship_action: ShipAction,
    state: &GameState,
    player_id: Uuid,
) -> Option<Ship> {
    let ship_action: ShipActionRust = parse_ship_action(ship_action);
    let old_ship = find_my_ship(state, player_id);
    if old_ship.is_none() {
        eprintln!("No ship");
        return None;
    }

    let old_ship = old_ship.unwrap();

    match ship_action {
        ShipActionRust::Unknown => {
            eprintln!("Unknown ship action");
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
    }
}

pub fn try_assign_quests(state: &mut GameState) {
    let state_read = state.clone();
    for player in state.players.iter_mut() {
        if player.quest.is_none() {
            let ship = find_my_ship(&state_read, player.id);
            if let Some(ship) = ship {
                player.quest = generate_random_quest(&state_read.planets, ship.docked_at)
            }
        }
    }
}
