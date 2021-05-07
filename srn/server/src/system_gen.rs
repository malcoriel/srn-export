use crate::new_id;
use crate::random_stuff::{gen_color, gen_planet_count, gen_planet_orbit_speed, gen_planet_radius, gen_sat_count, gen_sat_gap, gen_sat_orbit_speed, gen_sat_radius, gen_star_name, gen_star_radius, PLANET_NAMES, SAT_NAMES, gen_star_color};
use crate::world::{AsteroidBelt, GameState, Planet, Star, GameMode, Location, random_hex_seed_seeded};
use crate::market::{Market, init_all_planets_market};
use chrono::Utc;
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng, RngCore};
use std::collections::{VecDeque, HashMap};
use std::collections::hash_map::DefaultHasher;
use serde_derive::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};
use uuid::Uuid;
use crate::vec2::Vec2f64;
use std::f64::consts::PI;
use core::mem;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum PlanetType {
    Unknown,
    Ice,
    Jovian,
    Jungle,
    Barren,
}


pub struct PoolRandomPicker<T> {
    pub options: Vec<T>,
}

impl<T> PoolRandomPicker<T> {
    pub fn get(&mut self, prng: &mut SmallRng) -> T {
        let index = prng.gen_range(0, self.options.len());
        self.options.remove(index as usize)
    }
}

pub fn str_to_hash(t: String) -> u64 {
    let mut s = DefaultHasher::new();
    t.hash(&mut s);
    s.finish()
}

const LOCATION_COUNT: u32 = 5;
const DIST: f64 = 100.0;
const MAX_DIST: f64 = 250.0;

pub fn wire_shake_locations(locations: &mut Vec<Location>, prng: &mut SmallRng) {
    let all_ids = locations.iter().map(|l| l.id.clone()).collect::<Vec<_>>();
    let mut angle: f64 = 0.0;
    let mut loc_pos_by_id = HashMap::new();
    for loc in locations.iter_mut() {
        let x = angle.cos() * (DIST + prng.gen_range(0.0, 100.0)) ;
        let y = angle.sin() * (DIST + prng.gen_range(0.0, 100.0));
        angle += 2.0 * PI / LOCATION_COUNT as f64;
        loc.position = Vec2f64 {
            x, y
        };
        loc.adjacent_location_ids = all_ids.clone().into_iter().filter(|l| *l != loc.id).collect::<Vec<_>>();
        loc_pos_by_id.insert(loc.id, loc.position.clone());
    }
    for loc in locations.iter_mut() {
        loc.adjacent_location_ids = loc.adjacent_location_ids.clone().into_iter().filter_map(|adj| {
            let dist = loc.position.euclidean_distance(loc_pos_by_id.get(&adj).unwrap());
            if dist > MAX_DIST {
                return None;
            }
            return Some(adj);
        }).collect();
    }
}

pub fn system_gen(seed: String) -> GameState {
    let mut prng = SmallRng::seed_from_u64(str_to_hash(seed.clone()));

    let mut locations = vec![];
    for _i in 0..LOCATION_COUNT {
        let loc_seed = random_hex_seed_seeded(&mut prng);
        let location = gen_star_system_location(&loc_seed);
        locations.push(location);
    }

    wire_shake_locations(&mut locations, &mut prng);
    let now = Utc::now().timestamp_millis() as u64;
    let state = GameState {
        id: new_id(),
        seed: seed.clone(),
        tag: None,
        milliseconds_remaining: 3 * 60 * 1000,
        paused: false,
        my_id: new_id(),
        ticks: 0,
        locations,
        players: vec![],
        leaderboard: None,
        start_time_ticks: now,
        mode: GameMode::Unknown,
        disable_hp_effects: false,
        market: Market::new(),
        version: 1,
    };
    state
}

fn gen_star_system_location(seed: &String) -> Location {
    let mut prng = SmallRng::seed_from_u64(str_to_hash(seed.clone()));
    let star_id = crate::new_id();
    // the world is 1000x1000 for now,
    // so we have to divide 500 units between all zones

    let base_zone_width = 50.0;
    let zone_variation = 5.0;
    let base_gap_width = 50.0;
    let gap_variation = 5.0;
    let max = 500.0 - base_gap_width;
    let asteroid_belt_compression = 3.0;

    // width of zone + is_gap
    let mut zones = VecDeque::new();
    let mut current = 0.0;

    let mut index = 0;
    loop {
        let is_gap = index % 2 == 1;
        let width = if is_gap {
            base_gap_width + prng.gen_range(-1.0, 1.01) * gap_variation
        } else {
            base_zone_width + prng.gen_range(-1.0, 1.01) * zone_variation
        };
        zones.push_back((width, index));
        index += 1;
        current += width;

        if current >= max {
            break;
        }
    }

    let planet_count = zones.len() / 2;
    let asteroid_index = if planet_count % 2 == 0 {
        planet_count - 2
    } else {
        planet_count - 1
    };
    let mut planets = vec![];
    let mut asteroid_belts = vec![];

    let star_zone = zones.pop_front().unwrap();

    let star = gen_star(star_id, &mut prng, star_zone.0, Vec2f64 {
        x: 0.0,
        y: 0.0,
    });

    let mut planet_name_pool = PoolRandomPicker {
        options: Vec::from(PLANET_NAMES),
    };

    let mut sat_name_pool = PoolRandomPicker {
        options: Vec::from(SAT_NAMES),
    };

    let mut current_x = star_zone.0;
    loop {
        if let Some((width, index)) = zones.pop_front() {
            let is_gap = index % 2 == 1;
            if !is_gap {
                // too lazy to count correctly the index
                if index != asteroid_index {
                    let planet_id = new_id();
                    let name = planet_name_pool.get(&mut prng).to_string();

                    let planet_radius = gen_planet_radius(&mut prng);
                    let planet_center_x = current_x + width / 2.0;
                    let planet = gen_planet(&mut prng, star.id, index, planet_id, name, planet_radius, planet_center_x);
                    planets.push(planet);

                    let mut current_sat_x = planet_center_x + planet_radius + 10.0;
                    for j in 0..gen_sat_count(planet_radius, &mut prng) {
                        let name = sat_name_pool.get(&mut prng).to_string();
                        current_sat_x += gen_sat_gap(&mut prng);
                        planets.push(Planet {
                            id: new_id(),
                            name,
                            x: current_sat_x,
                            y: 0.0,
                            rotation: 0.0,
                            radius: gen_sat_radius(&mut prng),
                            orbit_speed: gen_sat_orbit_speed(&mut prng) / (j + 1) as f64,
                            anchor_id: planet_id,
                            anchor_tier: 2,
                            color: gen_color(&mut prng).to_string(),
                        })
                    }
                } else {
                    let middle = current_x + width / 2.0;
                    asteroid_belts.push(AsteroidBelt {
                        id: new_id(),
                        x: 0.0,
                        y: 0.0,
                        rotation: 0.0,
                        radius: middle,
                        width: width / asteroid_belt_compression,
                        count: 200,
                        orbit_speed: 0.006,
                        anchor_id: star_id,
                        anchor_tier: 0,
                        scale_mod: 1.0,
                    });
                    asteroid_belts.push(AsteroidBelt {
                        id: new_id(),
                        x: 0.0,
                        y: 0.0,
                        rotation: 0.0,
                        radius: middle - 3.0,
                        width: (width - 3.0) / asteroid_belt_compression,
                        count: 100,
                        orbit_speed: 0.004,
                        anchor_id: star_id,
                        anchor_tier: 0,
                        scale_mod: 2.0,
                    });
                    asteroid_belts.push(AsteroidBelt {
                        id: new_id(),
                        x: 0.0,
                        y: 0.0,
                        rotation: 0.0,
                        radius: middle + 5.0,
                        width: (width - 5.0) / asteroid_belt_compression,
                        count: 400,
                        orbit_speed: 0.008,
                        anchor_id: star_id,
                        anchor_tier: 0,
                        scale_mod: 0.5,
                    });
                }
            }
            current_x += width;
        } else {
            break;
        }
    }
    let mut location = Location::new_empty();
    location.seed = seed.clone();
    location.star = Some(star);
    location.planets = planets;
    location.asteroid_belts = asteroid_belts;
    location
}

pub fn gen_planet(mut prng: &mut SmallRng, anchor_id: Uuid, index: usize, planet_id: Uuid, name: String, planet_radius: f64, planet_center_x: f64) -> Planet {
    Planet {
        id: planet_id,
        name,
        x: planet_center_x,
        y: 0.0,
        rotation: 0.0,
        radius: planet_radius,
        orbit_speed: gen_planet_orbit_speed(&mut prng) / (index + 1) as f64,
        anchor_id,
        anchor_tier: 1,
        color: gen_color(&mut prng).to_string(),
    }
}

pub fn gen_planet_typed(p_type: PlanetType) -> Planet {
    Planet {
        id: new_id(),
        name: "".to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: 0.0,
        orbit_speed: 0.0,
        anchor_id: Default::default(),
        anchor_tier: 0,
        color: get_planet_type_color(p_type),
    }
}

pub fn get_planet_type_color(p_type: PlanetType) -> String {
    match p_type {
        PlanetType::Unknown => "#000000".to_string(),
        PlanetType::Ice => "#41b0f7".to_string(),
        PlanetType::Jovian => "#ee7e0e".to_string(),
        PlanetType::Jungle => "#00ed39".to_string(),
        PlanetType::Barren => "#a11010".to_string(),
    }
}

pub fn gen_star(star_id: Uuid, mut prng: &mut SmallRng, radius: f64, pos: Vec2f64) -> Star {
    let colors = gen_star_color(&mut prng);
    Star {
        color: colors.0.to_string(),
        corona_color: colors.1.to_string(),
        id: star_id.clone(),
        name: gen_star_name(&mut prng).to_string(),
        x: pos.x,
        y: pos.y,
        rotation: 0.0,
        radius,
    }
}

pub fn seed_personal_state(client_id: Uuid, mode: &GameMode) -> GameState {
    match mode {
        GameMode::Unknown => {
            panic!("Unknown mode to seed");
        }
        GameMode::CargoRush => {
            let mut state = system_gen(client_id.to_string());
            init_all_planets_market(&mut state);
            state.id = client_id;
            state
        }
        GameMode::Tutorial => {
            make_tutorial_state(client_id)
        }
        GameMode::Sandbox => {
            make_sandbox_state(client_id)
        }
    }
}


pub fn make_tutorial_state(client_id: Uuid) -> GameState {
    let seed = "tutorial".to_owned();
    let now = Utc::now().timestamp_millis() as u64;

    let mut prng = SmallRng::seed_from_u64(str_to_hash(seed.clone()));
    let star_id = new_id();

    let star = Star {
        color: "rgb(100, 200, 85)".to_string(),
        corona_color: "rgb(100, 200, 85)".to_string(),
        id: star_id.clone(),
        name: gen_star_name(&mut prng).to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: 30.0,
    };

    let planet_id = new_id();
    let mut location = Location::new_empty();
    location.seed = seed.clone();
    location.star = Some(star);
    location.planets = vec![
            Planet {
                id: planet_id,
                name: "Schoolia".to_string(),
                x: 100.0,
                y: 0.0,
                rotation: 0.0,
                radius: 8.0,
                orbit_speed: 0.01,
                anchor_id: star_id.clone(),
                anchor_tier: 1,
                color: "#11ffff".to_string(),
            },
            Planet {
                id: new_id(),
                name: "Sat".to_string(),
                x: 120.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.5,
                orbit_speed: 0.005,
                anchor_id: planet_id.clone(),
                anchor_tier: 2,
                color: "#ff0033".to_string(),
            }
        ];
    GameState {
        id: client_id,
        version: 1,
        mode: GameMode::Tutorial,
        tag: None,
        seed: seed.clone(),
        my_id: Default::default(),
        start_time_ticks: now,
        locations: vec![
            location
        ],
        players: vec![],
        milliseconds_remaining: 60 * 1000,
        paused: false,
        leaderboard: None,
        ticks: 0,
        disable_hp_effects: false,
        market: Market::new(),
    }
}


pub fn make_sandbox_state(client_id: Uuid) -> GameState {
    let seed = "sandbox".to_owned();
    let now = Utc::now().timestamp_millis() as u64;

    GameState {
        id: client_id,
        version: 1,
        mode: GameMode::Sandbox,
        tag: None,
        seed: seed.clone(),
        my_id: Default::default(),
        start_time_ticks: now,
        locations: vec![
            Location::new_empty()],
        players: vec![],
        milliseconds_remaining: 99 * 60 * 1000,
        paused: false,
        leaderboard: None,
        ticks: 0,
        disable_hp_effects: true,
        market: Market::new(),
    }
}
