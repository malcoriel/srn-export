use crate::vec2::{angle_rad, rotate, AsVec2f64, Precision, Vec2f64};
use crate::DEBUG_PHYSICS;
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use std::borrow::{Borrow, BorrowMut};
use std::collections::HashMap;
use std::f64::consts::PI;
use uuid::Uuid;
const SEED_TIME: i64 = 9321 * 1000 * 1000;
use chrono::Utc;
use itertools::Itertools;
use uuid::*;

const SHIP_SPEED: f64 = 3.0;

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
    let planets_with_star = planets
        .clone()
        .into_iter()
        .chain(vec![Planet {
            color: Default::default(),
            name: star.name,
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
    let by_id = index_planets_by_id(&planets_with_star);
    let mut anchors = {
        let mut anchors = HashMap::new();
        for p in planets.into_iter() {
            anchors
                .entry(p.anchor_id)
                .or_insert((*by_id.get(&p.anchor_id).unwrap()).clone());
        }
        anchors
    };

    let mut planets = planets.clone();
    let mut shifts = HashMap::new();

    for tier in 1..3 {
        planets = planets
            .iter()
            .map(|p| {
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
            })
            .collect::<Vec<Planet>>();
    }

    planets
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
                    player.money += quest.reward;
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
    let pickup = planets
        .into_iter()
        .filter(|p| p.id != docked_at.unwrap_or(Default::default()))
        .collect::<Vec<_>>();
    let from = &pickup[rng.gen_range(0, pickup.len())];
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
}

pub fn seed_state(debug: bool) -> GameState {
    let star_id = crate::new_id();
    let star = Star {
        color: "#ff1b00".to_string(),
        id: star_id.clone(),
        name: "Zinides".to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: 10.0,
    };

    let small_id = crate::new_id();

    let small_planet = Planet {
        id: small_id,
        color: "blue".to_string(),
        name: "Dabayama".to_string(),
        x: 19.0,
        y: 0.0,
        rotation: 0.0,
        radius: 2.0,
        orbit_speed: 0.2,
        anchor_id: star_id.clone(),
        anchor_tier: 1,
    };

    let big_planet = Planet {
        color: "orange".to_string(),
        id: crate::new_id(),
        name: "Sunov".to_string(),
        x: 30.0,
        y: 0.0,
        rotation: 0.0,
        radius: 3.0,
        orbit_speed: 0.05,
        anchor_id: star_id.clone(),
        anchor_tier: 1,
    };

    let sat1 = Planet {
        color: "gray".to_string(),
        id: crate::new_id(),
        name: "D1".to_string(),
        x: 35.9,
        y: 0.0,
        rotation: 0.0,
        radius: 1.5,
        orbit_speed: 0.3,
        anchor_id: big_planet.id.clone(),
        anchor_tier: 2,
    };

    let sat2 = Planet {
        color: "gray".to_string(),
        id: crate::new_id(),
        name: "D2".to_string(),
        // TODO having it as 23.7 makes client panic in deserialization, wtf?
        x: 21.7,
        y: 0.0,
        rotation: 0.0,
        radius: 1.2,
        orbit_speed: 0.5,
        anchor_id: big_planet.id.clone(),
        anchor_tier: 2,
    };

    let now = Utc::now().timestamp_millis() as u64;
    let mut state = GameState {
        tag: None,
        milliseconds_remaining: 60 * 1000 * 3 * 1000,
        paused: false,
        my_id: crate::new_id(),
        ticks: 0,
        star: Some(star),
        planets: vec![
            Planet {
                color: "orange".to_string(),
                id: crate::new_id(),
                name: "Robrapus".to_string(),
                x: 15.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.5,
                orbit_speed: 0.05,
                anchor_id: star_id.clone(),
                anchor_tier: 1,
            },
            small_planet,
            sat1,
            sat2,
            Planet {
                color: "greenyellow".to_string(),
                id: crate::new_id(),
                name: "Eustea".to_string(),
                x: 40.0,
                y: 0.0,
                rotation: 0.0,
                radius: 2.0,
                orbit_speed: 0.1,
                anchor_id: star_id.clone(),
                anchor_tier: 1,
            },
            big_planet,
        ],
        ships: vec![],
        players: vec![],
        leaderboard: None,
        start_time_ticks: now,
    };
    state.planets = update_planets(&state.planets, &state.star, SEED_TIME);
    if debug {
        eprintln!("{}", serde_json::to_string_pretty(&state).ok().unwrap());
    }
    state
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
            state = seed_state(false);
            state.players = players.clone();
            for player in players.iter() {
                spawn_ship(&mut state, &player.id);
            }
        } else {
            // eprintln!("waiting for reset");
        }
    } else {
        if state.milliseconds_remaining <= 0 {
            eprintln!("game end");
            state.paused = true;
            if !client {
                state.leaderboard = make_leaderboard(&state.players);
            }
            state.milliseconds_remaining = 10 * 1000;
        } else {
            // eprintln!("playing");
            state.planets = update_planets(&state.planets, &state.star, elapsed);
            state.ships = update_ships_on_planets(&state.planets, &state.ships);
            state.ships = update_ships_navigation(&state.ships, elapsed);
            if !client {
                state.players = update_quests(&state.players, &state.ships, &state.planets);
            }
        }
    }

    state
}

pub fn add_player(state: &mut GameState, player_id: &Uuid) {
    state.players.push(Player {
        id: player_id.clone(),
        ship_id: None,
        name: player_id.to_string(),
        quest: None,
        money: 0,
    })
}

pub fn spawn_ship(state: &mut GameState, player_id: &Uuid) {
    let ship = Ship {
        id: crate::new_id(),
        color: "blue".to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: 1.0,
        docked_at: None,
        navigate_target: None,
        dock_target: None,
    };
    state
        .players
        .iter_mut()
        .find(|p| p.id == *player_id)
        .map(|p| p.ship_id = Some(ship.id));
    state.ships.push(ship);
}

pub fn update_ships_navigation(ships: &Vec<Ship>, elapsed_micro: i64) -> Vec<Ship> {
    let mut res = vec![];
    for mut ship in ships.clone() {
        if let Some(target) = ship.navigate_target {
            if !ship.docked_at.is_some() {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let dist = target.euclidean_distance(&ship_pos);
                let max_shift = SHIP_SPEED * elapsed_micro as f64 / 1000.0 / 1000.0;
                if dist > 0.0 {
                    if dist > max_shift {
                        let dir = target.subtract(&ship_pos).normalize();
                        let shift = dir.scalar_mul(SHIP_SPEED);
                        let new_pos = ship_pos.add(&shift);
                        ship.set_from(&new_pos);
                    } else {
                        ship.set_from(&target);
                        ship.navigate_target = None;
                    }
                } else {
                    ship.navigate_target = None;
                }
            } else {
                ship.navigate_target = None;
            }
        }
        res.push(ship);
    }
    res
}
