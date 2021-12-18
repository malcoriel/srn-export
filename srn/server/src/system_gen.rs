use core::mem;
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, VecDeque};
use std::f64::consts::PI;
use std::hash::{Hash, Hasher};

use chrono::Utc;
use rand::rngs::SmallRng;
use rand::{Rng, RngCore, SeedableRng};
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::market::{init_all_planets_market, Market};
use crate::perf::Sampler;
use crate::random_stuff::{
    gen_color, gen_planet_count, gen_planet_orbit_speed, gen_planet_radius, gen_sat_count,
    gen_sat_gap, gen_sat_orbit_speed, gen_sat_radius, gen_star_color, gen_star_name,
    gen_star_radius, PLANET_NAMES, SAT_NAMES,
};
use crate::vec2::Vec2f64;
use crate::world::{random_hex_seed_seeded, AsteroidBelt, Container, GameMode, GameState, Location, Planet, Star, AABB, GAME_STATE_VERSION, ObjectTag};
use crate::{new_id, planet_movement, world};
use crate::combat::Health;

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
        let x = angle.cos() * (DIST + prng.gen_range(0.0, 100.0));
        let y = angle.sin() * (DIST + prng.gen_range(0.0, 100.0));
        angle += 2.0 * PI / LOCATION_COUNT as f64;
        loc.position = Vec2f64 { x, y };
        loc.adjacent_location_ids = all_ids
            .clone()
            .into_iter()
            .filter(|l| *l != loc.id)
            .collect::<Vec<_>>();
        loc_pos_by_id.insert(loc.id, loc.position.clone());
    }
    for loc in locations.iter_mut() {
        loc.adjacent_location_ids = loc
            .adjacent_location_ids
            .clone()
            .into_iter()
            .filter_map(|adj| {
                let dist = loc
                    .position
                    .euclidean_distance(loc_pos_by_id.get(&adj).unwrap());
                if dist > MAX_DIST {
                    return None;
                }
                return Some(adj);
            })
            .collect();
    }
}

pub const MIN_CONTAINER_DISTANCE: f64 = 50.0;
pub const CONTAINER_COUNT: i32 = 10;

fn gen_star_system_location(seed: &String, opts: &GenStateOpts) -> Location {
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

    zones.push_back((gen_star_radius(&mut prng), 0));
    let mut index = 1;
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
        if zones.len() as u32 > opts.max_planets_in_system + 1 {
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

    let star = gen_star(star_id, &mut prng, star_zone.0, Vec2f64 { x: 0.0, y: 0.0 });

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
                    let planet = gen_planet(
                        &mut prng,
                        star.id,
                        index,
                        planet_id,
                        name,
                        planet_radius,
                        planet_center_x,
                    );
                    planets.push(planet);

                    let mut current_sat_x = planet_center_x + planet_radius + 10.0;
                    for j in 0..(gen_sat_count(planet_radius, &mut prng)
                        .min(opts.max_satellites_for_planet))
                    {
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
                            health: None,
                            tags: Default::default()
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
    location.star = Some(star.clone());
    location.planets = planets;
    location.asteroid_belts = asteroid_belts;
    location.containers = vec![];
    for _i in 0..CONTAINER_COUNT {
        let container = Container::random(&mut prng);
        let mut res_container = Some(container.clone());
        for p in location.planets.iter() {
            if container
                .position
                .euclidean_distance(&Vec2f64 { x: p.x, y: p.y })
                < MIN_CONTAINER_DISTANCE
            {
                res_container = None;
            }
        }
        if container.position.euclidean_distance(&Vec2f64 {
            x: location.star.as_ref().map_or(0.0, |s| s.x),
            y: location.star.as_ref().map_or(0.0, |s| s.y),
        }) < MIN_CONTAINER_DISTANCE
        {
            res_container = None;
        }
        if let Some(container) = res_container {
            location.containers.push(container);
        }
    }
    location
}

pub fn gen_planet(
    mut prng: &mut SmallRng,
    anchor_id: Uuid,
    index: usize,
    planet_id: Uuid,
    name: String,
    planet_radius: f64,
    planet_center_x: f64,
) -> Planet {
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
        health: None,
        tags: Default::default()
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
        health: None,
        tags: Default::default()
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

pub fn seed_state(mode: &GameMode, seed: String) -> GameState {
    match mode {
        GameMode::Unknown => {
            panic!("Unknown mode to seed");
        }
        GameMode::CargoRush => {
            let mut state = gen_state(seed, GenStateOpts::default());
            init_all_planets_market(&mut state);
            state.id = new_id();
            state.mode = GameMode::CargoRush;
            state
        }
        GameMode::Tutorial => make_tutorial_state(),
        GameMode::Sandbox => make_sandbox_state(),
        GameMode::PirateDefence => make_pirate_defence_state(seed),
    }
}

fn assign_health_to_planets (planets: &mut Vec<Planet>, health: Health) {
    for mut planet in planets.into_iter() {
        planet.health = Some(health.clone())
    }
}

fn make_pirate_defence_state(seed: String) -> GameState {
    let mut gen_opts = GenStateOpts::default();
    gen_opts.max_planets_in_system = 1;
    gen_opts.max_satellites_for_planet = 0;
    let mut state = gen_state(seed, gen_opts);
    assign_health_to_planets(&mut state.locations[0].planets, Health::new(100.0));
    state.locations[0].planets[0].tags.insert(ObjectTag::Unlandable);
    state.milliseconds_remaining = 5 * 1000 * 60;
    state.mode = GameMode::PirateDefence;
    state
}

fn make_tutorial_state() -> GameState {
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
            color: "#008FA9".to_string(),
            health: None,
            tags: Default::default()
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
            color: "#1D334A".to_string(),
            health: None,
            tags: Default::default()
        },
    ];
    GameState {
        id: new_id(),
        version: GAME_STATE_VERSION,
        mode: GameMode::Tutorial,
        tag: None,
        seed: seed.clone(),
        my_id: Default::default(),
        start_time_ticks: now,
        locations: vec![location],
        players: vec![],
        milliseconds_remaining: 60 * 1000,
        paused: false,
        leaderboard: None,
        millis: 0,
        disable_hp_effects: false,
        market: Market::new(),
        interval_data: Default::default(),
        game_over: None,
        events: Default::default(),
        processed_events: vec![]
    }
}

pub fn make_sandbox_state() -> GameState {
    let seed = "sandbox".to_owned();
    let now = Utc::now().timestamp_millis() as u64;

    GameState {
        id: new_id(),
        version: GAME_STATE_VERSION,
        mode: GameMode::Sandbox,
        tag: None,
        seed: seed.clone(),
        my_id: Default::default(),
        start_time_ticks: now,
        locations: vec![Location::new_empty()],
        players: vec![],
        milliseconds_remaining: 99 * 60 * 1000,
        paused: false,
        leaderboard: None,
        millis: 0,
        disable_hp_effects: true,
        market: Market::new(),
        interval_data: Default::default(),
        game_over: None,
        events: Default::default(),
        processed_events: vec![]
    }
}

pub fn seed_state_test(_debug: bool) -> GameState {
    let seed = world::random_hex_seed();
    log!(format!("Starting seeding state with seed={}", seed));
    let mut state = gen_state(seed, GenStateOpts::default());
    init_all_planets_market(&mut state);
    log!(format!("Done."));
    state
}

struct GenStateOpts {
    system_count: u32,
    max_planets_in_system: u32,
    max_satellites_for_planet: u32,
}

impl Default for GenStateOpts {
    fn default() -> Self {
        GenStateOpts {
            system_count: 1,
            max_planets_in_system: 10,
            max_satellites_for_planet: 3,
        }
    }
}

fn gen_state(seed: String, opts: GenStateOpts) -> GameState {
    let mut prng = SmallRng::seed_from_u64(str_to_hash(seed.clone()));
    let mut locations = vec![];
    for _i in 0..opts.system_count {
        let loc_seed = random_hex_seed_seeded(&mut prng);
        let location = gen_star_system_location(&loc_seed, &opts);
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
        millis: 0,
        locations,
        players: vec![],
        leaderboard: None,
        start_time_ticks: now,
        mode: GameMode::Unknown,
        disable_hp_effects: false,
        market: Market::new(),
        version: GAME_STATE_VERSION,
        interval_data: Default::default(),
        game_over: None,
        events: Default::default(),
        processed_events: vec![]
    };

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
}

const SEED_TIME: i64 = 9321 * 1000 * 1000;

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

const MAX_ORBIT: f64 = 450.0;
