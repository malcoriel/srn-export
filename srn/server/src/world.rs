use crate::vec2::{angle_rad, rotate, AsVec2f64, Precision, Vec2f64};
use crate::{dialogue, new_id, DEBUG_PHYSICS};
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use std::borrow::{Borrow, BorrowMut};
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;
use uuid::Uuid;
const SEED_TIME: i64 = 9321 * 1000 * 1000;
use crate::dialogue::{Dialogue, DialogueStates, DialogueTable, DialogueUpdate};
use crate::random_stuff::{
    gen_color, gen_planet_count, gen_planet_gap, gen_planet_name, gen_planet_orbit_speed,
    gen_planet_radius, gen_sat_count, gen_sat_gap, gen_sat_name, gen_sat_orbit_speed,
    gen_sat_radius, gen_star_name, gen_star_radius,
};
use chrono::Utc;
use itertools::Itertools;
use uuid::*;

const SHIP_SPEED: f64 = 20.0;

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

fn index_planets_by_id(planets: &Vec<Planet>) -> HashMap<Uuid, &Planet> {
    let mut by_id = HashMap::new();
    for p in planets.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

pub fn update_planets(
    planets: &Vec<Planet>,
    star: &Option<Star>,
    elapsed_micro: i64,
) -> Vec<Planet> {
    let star = star.clone().unwrap_or(Star {
        x: 0.0,
        y: 0.0,
        radius: 0.0,
        rotation: 0.0,
        id: crate::new_id(),
        name: "".to_string(),
        color: "".to_string(),
    });
    let planets_with_star = make_planets_with_star(planets, &star);
    let by_id = index_planets_by_id(&planets_with_star);
    let mut anchors = build_anchors_from_planets(planets, &by_id);

    let mut planets = planets.clone();
    let mut shifts = HashMap::new();

    for tier in 1..3 {
        planets = planets
            .iter()
            .map(|p| simulate_planet_movement(elapsed_micro, &mut anchors, &mut shifts, tier, p))
            .collect::<Vec<Planet>>();
    }

    planets
}

fn make_planets_with_star(planets: &Vec<Planet>, star: &Star) -> Vec<Planet> {
    let planets_with_star = planets
        .clone()
        .into_iter()
        .chain(vec![Planet {
            color: Default::default(),
            name: star.name.clone(),
            id: star.id,
            x: star.x,
            y: star.y,
            rotation: star.rotation,
            radius: star.radius,
            orbit_speed: 0.0,
            anchor_id: Default::default(),
            anchor_tier: 0,
        }])
        .collect::<Vec<_>>();
    planets_with_star
}

fn build_anchors_from_planets(
    planets: &Vec<Planet>,
    by_id: &HashMap<Uuid, &Planet>,
) -> HashMap<Uuid, Planet> {
    let mut anchors = HashMap::new();
    for p in planets.into_iter() {
        anchors
            .entry(p.anchor_id)
            .or_insert((*by_id.get(&p.anchor_id).unwrap()).clone());
    }
    anchors
}

fn simulate_planet_movement(
    elapsed_micro: i64,
    anchors: &mut HashMap<Uuid, Planet>,
    shifts: &mut HashMap<Uuid, Vec2f64>,
    tier: u32,
    p: &Planet,
) -> Planet {
    let mut p = p.clone();

    if p.anchor_tier != tier {
        if DEBUG_PHYSICS {
            eprintln!(
                "skipping {} (tier {}) for tier {}",
                p.name, p.anchor_tier, tier
            );
        }
        return p;
    }

    if DEBUG_PHYSICS {
        println!("p {} elapsed {}", p.id, elapsed_micro);
    }
    let anchor = anchors.get(&p.anchor_id).unwrap();

    if DEBUG_PHYSICS {
        println!("anchor position {}/{}", anchor.x, anchor.y);
    }

    let anchor_shift = shifts
        .get(&p.anchor_id)
        .unwrap_or(&Vec2f64 { x: 0.0, y: 0.0 });

    if DEBUG_PHYSICS {
        println!("anchor shift {}", anchor_shift.as_key(Precision::P2))
    }

    let current_pos_relative = Vec2f64 {
        x: p.x + anchor_shift.x - anchor.x,
        y: p.y + anchor_shift.y - anchor.y,
    };

    let old = Vec2f64 { x: p.x, y: p.y };
    if DEBUG_PHYSICS {
        println!("current {}", current_pos_relative);
    }

    let orbit_length = current_pos_relative.euclidean_len();

    let base_vec = Vec2f64 {
        x: orbit_length,
        y: 0.0,
    };
    let mut current_angle = angle_rad(base_vec.clone(), current_pos_relative);
    if current_pos_relative.y > 0.0 {
        current_angle = 2.0 * PI - current_angle;
    }
    if DEBUG_PHYSICS {
        eprintln!("name {}", p.name);
        eprintln!("anchor {}/{}", anchor.x, anchor.y);
        eprintln!("base_vec {}/{}", base_vec.x, base_vec.y);
        eprintln!("dist {}", orbit_length);
    }

    let angle_diff = p.orbit_speed * (elapsed_micro as f64) / 1000.0 / 1000.0;
    if DEBUG_PHYSICS {
        println!("current angle: {}", current_angle);
        println!("angle diff: {}", angle_diff);
    }
    let new_angle = (current_angle + angle_diff) % (2.0 * PI);
    if DEBUG_PHYSICS {
        println!("new_angle: {}", new_angle);
    }
    let new_vec = rotate(base_vec.clone(), new_angle);
    p.x = anchor.x + new_vec.x;
    p.y = anchor.y + new_vec.y;
    if DEBUG_PHYSICS {
        println!("new_vec {}", new_vec);
    }
    if DEBUG_PHYSICS {
        println!("new pos {}", p.as_vec());
    }
    anchors.remove_entry(&p.id);
    anchors.insert(p.id, p.clone());
    shifts.insert(p.id, p.as_vec().subtract(&old));
    return p;
}

pub fn update_quests(
    players: &Vec<Player>,
    ships: &Vec<Ship>,
    planets: &Vec<Planet>,
) -> Vec<Player> {
    let ships_by_id = {
        let mut by_id = HashMap::new();
        for s in ships.iter() {
            by_id.entry(s.id).or_insert(s);
        }
        by_id
    };

    players
        .into_iter()
        .map(|p| {
            let mut player = p.clone();
            if let Some(quest) = &p.quest {
                if let Some(ship) = ships_by_id.get(&p.ship_id.unwrap_or(Default::default())) {
                    if let Some(docked_at) = ship.docked_at {
                        if quest.state == QuestState::Started {
                            if docked_at == quest.from_id {
                                let mut quest = player.borrow().quest.clone().unwrap();
                                quest.state = QuestState::Picked;
                                player.borrow_mut().quest = Some(quest);
                            }
                        } else if quest.state == QuestState::Picked {
                            if docked_at == quest.to_id {
                                let mut quest = player.borrow().quest.clone().unwrap();
                                quest.state = QuestState::Delivered;
                                player.borrow_mut().quest = Some(quest);
                            }
                        }
                    }
                }
                if quest.state == QuestState::Delivered {
                    if player.is_bot {
                        player.money += quest.reward / 2;
                    } else {
                        player.money += quest.reward;
                    }
                    player.quest = None;
                }
            } else {
                if let Some(ship) = ships_by_id.get(&p.ship_id.unwrap_or(Default::default())) {
                    player.quest = generate_random_quest(planets, ship.docked_at);
                }
            }
            player
        })
        .collect::<Vec<_>>()
}

fn generate_random_quest(planets: &Vec<Planet>, docked_at: Option<Uuid>) -> Option<Quest> {
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
        state: QuestState::Started,
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
pub struct Ship {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
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
pub enum QuestState {
    Unknown = 0,
    Started = 1,
    Picked = 2,
    Delivered = 3,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Quest {
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub state: QuestState,
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
    pub ships: Vec<Ship>,
    pub players: Vec<Player>,
    pub milliseconds_remaining: i32,
    pub paused: bool,
    pub leaderboard: Option<Leaderboard>,
    pub ticks: u32,
    pub dialogue: Option<Dialogue>,
}

const ORB_SPEED_MULT: f64 = 1.0;

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
        ships: vec![],
        players: vec![],
        leaderboard: None,
        start_time_ticks: now,
        dialogue: None,
    };
    let state = if seed_and_validate {
        let mut state = validate_state(state);
        state.planets = update_planets(&state.planets, &state.star, SEED_TIME);
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

const MAX_ORBIT: f64 = 400.0;

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

pub fn update(mut state: GameState, elapsed: i64, client: bool) -> GameState {
    state.ticks += elapsed as u32 / 1000;

    if !client {
        state.milliseconds_remaining -= elapsed as i32 / 1000;
    }

    if state.paused {
        if state.milliseconds_remaining <= 0 {
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
                spawn_ship(&mut state, &player.id, None);
            }
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
        } else {
            state.planets = update_planets(&state.planets, &state.star, elapsed);
            state.ships = update_ships_on_planets(&state.planets, &state.ships);
            state.ships = update_ships_navigation(
                &state.ships,
                &state.planets,
                &state.star.clone().unwrap(),
                elapsed,
            );
            if !client {
                state.players = update_quests(&state.players, &state.ships, &state.planets);
            }
        }
    }
    state
}

pub fn add_player(state: &mut GameState, player_id: &Uuid, is_bot: bool, name: Option<String>) {
    state.players.push(Player {
        id: player_id.clone(),
        is_bot,
        ship_id: None,
        name: name.unwrap_or(player_id.to_string()),
        quest: None,
        money: 0,
    })
}

pub fn spawn_ship(state: &mut GameState, player_id: &Uuid, at: Option<Vec2f64>) {
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
        .find(|p| p.id == *player_id)
        .map(|p| p.ship_id = Some(ship.id));
    state.ships.push(ship);
}

pub fn update_ships_navigation(
    ships: &Vec<Ship>,
    planets: &Vec<Planet>,
    star: &Star,
    elapsed_micro: i64,
) -> Vec<Ship> {
    let mut res = vec![];
    let planets_with_star = make_planets_with_star(&planets, star);
    let planets_by_id = index_planets_by_id(&planets_with_star);
    for mut ship in ships.clone() {
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
                if let Some(planet) = planets_by_id.get(&target).clone() {
                    let ship_pos = Vec2f64 {
                        x: ship.x,
                        y: ship.y,
                    };
                    let planet_pos = Vec2f64 {
                        x: planet.x,
                        y: planet.y,
                    };
                    ship.trajectory = build_trajectory_to_planet(ship_pos, planet, &planets_by_id);
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

const TRAJECTORY_STEP_MICRO: i64 = 250 * 1000;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;

// TODO for some weird reason, it works for anchor_tier=2 too, however I do not support it here!
fn build_trajectory_to_planet(
    from: Vec2f64,
    to: &Planet,
    by_id: &HashMap<Uuid, &Planet>,
) -> Vec<Vec2f64> {
    // let start = Utc::now();
    let mut anchors = build_anchors_from_planets(&vec![to.clone()], by_id);
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
        current_target = simulate_planet_movement(
            TRAJECTORY_STEP_MICRO,
            &mut anchors,
            &mut shifts,
            current_target.anchor_tier,
            &current_target,
        );
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

fn build_trajectory_to_point(from: Vec2f64, to: &Vec2f64) -> Vec<Vec2f64> {
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

pub fn find_my_ship<'a, 'b>(state: &'a GameState, player_id: &'b Uuid) -> Option<&'a Ship> {
    let player = find_my_player(state, player_id);
    if let Some(player) = player {
        if let Some(ship_id) = player.ship_id {
            return state.ships.iter().find(|ship| ship.id == ship_id);
        }
    }
    return None;
}

pub fn find_my_player<'a, 'b>(state: &'a GameState, player_id: &'b Uuid) -> Option<&'a Player> {
    state.players.iter().find(|p| p.id == *player_id)
}

pub fn execute_dialog_option(
    client_id: &Uuid,
    state: &mut GameState,
    dialogue_update: DialogueUpdate,
    states: &mut DialogueStates,
    dialogue_table: &DialogueTable,
) -> (Option<Dialogue>, bool) {
    dialogue::execute_dialog_option(client_id, state, dialogue_update, states, dialogue_table)
}

pub type PlayerId = Uuid;
