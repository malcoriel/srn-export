use core::mem;
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, VecDeque};
use std::f64::consts::PI;
use std::hash::{Hash, Hasher};

use chrono::Utc;
use rand_pcg::Pcg64Mcg;
use rand::{Rng, RngCore, SeedableRng};
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::combat::Health;
use crate::market::{init_all_planets_market, Market};
use crate::perf::Sampler;
use crate::random_stuff::{gen_color, gen_planet_count, gen_planet_orbit_speed, gen_planet_radius, gen_sat_count, gen_sat_gap, gen_sat_orbit_speed, gen_sat_radius, gen_star_color, gen_star_name, gen_star_radius, random_hex_seed_seeded, PLANET_NAMES, SAT_NAMES, gen_sat_orbit_period};
use crate::vec2::Vec2f64;
use crate::world::{AsteroidBelt, Container, GameMode, GameState, Location, ObjectProperty, Star, AABB, GAME_STATE_VERSION, PlanetV2, SpatialProps, Movement};
use crate::{planet_movement, prng_id, seed_prng, world};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;
use crate::indexing::ObjectSpecifier;

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
    pub fn get(&mut self, prng: &mut Pcg64Mcg) -> T {
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

pub fn wire_shake_locations(locations: &mut Vec<Location>, prng: &mut Pcg64Mcg) {
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
    let mut prng = Pcg64Mcg::seed_from_u64(str_to_hash(seed.clone()));
    let star_id = prng_id(&mut prng);
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
                    let planet_id = prng_id(&mut prng);
                    let name = planet_name_pool.get(&mut prng).to_string();

                    let planet_radius = gen_planet_radius(&mut prng);
                    let planet_center_x = current_x + width / 2.0;
                    let planet = gen_planet(
                        &mut prng,
                        ObjectSpecifier::Star {
                            id: star.id,
                        },
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
                        planets.push(PlanetV2 {
                            id: prng_id(&mut prng),
                            name,
                            spatial: SpatialProps {
                                position: Vec2f64 {
                                    x: current_sat_x,
                                    y: 0.0,
                                },
                                rotation_rad: 0.0,
                                radius: gen_sat_radius(&mut prng),
                            },
                            anchor_tier: 2,
                            color: gen_color(&mut prng).to_string(),
                            health: None,
                            properties: Default::default(),
                            movement: Movement::RadialMonotonous {
                                full_period_ticks: gen_sat_orbit_period(&mut prng, j + 1),
                                radius_to_anchor: 0.0,
                                clockwise: false,
                                anchor: ObjectSpecifier::Planet {
                                    id: planet_id,
                                },
                                relative_position: Default::default(),
                                interpolation_hint: None,
                            },
                        })
                    }
                } else {
                    let middle = current_x + width / 2.0;
                    asteroid_belts.push(AsteroidBelt {
                        id: prng_id(&mut prng),
                        width: width / asteroid_belt_compression,
                        count: 200,
                        scale_mod: 1.0,
                        spatial: SpatialProps {
                            position: Vec2f64::zero(),
                            rotation_rad: 0.0,
                            radius: middle,
                        },
                        movement: Movement::RadialMonotonous {
                            full_period_ticks: (60 * 1000 * 1000) as f64,
                            radius_to_anchor: 0.0,
                            clockwise: false,
                            anchor: ObjectSpecifier::Star {
                                id: star_id
                            },
                            relative_position: Default::default(),
                            interpolation_hint: None
                        }
                    });
                    asteroid_belts.push(AsteroidBelt {
                        id: prng_id(&mut prng),
                        width: (width - 3.0) / asteroid_belt_compression,
                        count: 100,
                        scale_mod: 2.0,
                        spatial: SpatialProps {
                            position: Default::default(),
                            rotation_rad: 0.0,
                            radius: middle - 3.0
                        },
                        movement: Movement::RadialMonotonous {
                            full_period_ticks: (180 * 1000 * 1000) as f64,
                            radius_to_anchor: 0.0,
                            clockwise: false,
                            anchor: ObjectSpecifier::Star {
                                id: star_id,
                            },
                            relative_position: Default::default(),
                            interpolation_hint: None
                        }
                    });
                    asteroid_belts.push(AsteroidBelt {
                        id: prng_id(&mut prng),
                        width: (width - 5.0) / asteroid_belt_compression,
                        count: 400,
                        scale_mod: 0.5,
                        spatial: SpatialProps {
                            position: Default::default(),
                            rotation_rad: 0.0,
                            radius: middle + 5.0,
                        }
                        ,
                        movement: Movement::RadialMonotonous {
                            full_period_ticks: (40 * 1000 * 1000) as f64,
                            radius_to_anchor: 0.0,
                            clockwise: false,
                            anchor: ObjectSpecifier::Star {
                                id: star_id,
                            },
                            relative_position: Default::default(),
                            interpolation_hint: None
                        }
                    });
                }
            }
            current_x += width;
        } else {
            break;
        }
    }
    let mut location = Location::new_empty(prng_id(&mut prng));
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
                .euclidean_distance(&p.spatial.position)
                < MIN_CONTAINER_DISTANCE
            {
                res_container = None;
            }
        }
        if container.position.euclidean_distance(&Vec2f64 {
            x: location.star.as_ref().map_or(0.0, |s| s.spatial.position.x),
            y: location.star.as_ref().map_or(0.0, |s| s.spatial.position.y),
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
    mut prng: &mut Pcg64Mcg,
    anchor: ObjectSpecifier,
    planet_id: Uuid,
    name: String,
    planet_radius: f64,
    planet_center_x: f64,
) -> PlanetV2 {
    PlanetV2 {
        id: planet_id,
        name,
        spatial: SpatialProps {
            position: Vec2f64 {
                x: planet_center_x,
                y: 0.0,
            },
            radius: planet_radius,
            rotation_rad: 0.0,
        },
        anchor_tier: 1,
        color: gen_color(&mut prng).to_string(),
        health: None,
        properties: Default::default(),
        movement: Movement::RadialMonotonous {
            full_period_ticks: 0.0,
            radius_to_anchor: 0.0,
            clockwise: false,
            anchor,
            relative_position: Default::default(),
            interpolation_hint: None,
        },
    }
}

pub fn gen_planet_typed(p_type: PlanetType, id: Uuid) -> PlanetV2 {
    PlanetV2 {
        id,
        name: "".to_string(),
        spatial: SpatialProps {
            position: Vec2f64 {
                x: 0.0,
                y: 0.0,
            },
            rotation_rad: 0.0,
            radius: 0.0
        },
        anchor_tier: 0,
        color: get_planet_type_color(p_type),
        health: None,
        properties: Default::default(),
        movement: Movement::None,
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

pub fn gen_star(star_id: Uuid, mut prng: &mut Pcg64Mcg, radius: f64, pos: Vec2f64) -> Star {
    let colors = gen_star_color(&mut prng);
    Star {
        color: colors.0.to_string(),
        corona_color: colors.1.to_string(),
        spatial: SpatialProps {
            position: Vec2f64 {
                x: pos.x,
                y: pos.y,
            },
            rotation_rad: 0.0,
            radius,
        },
        id: star_id.clone(),
        name: gen_star_name(&mut prng).to_string(),
        movement: Movement::None,
    }
}

pub fn seed_state(mode: &GameMode, seed: String, opts: Option<GenStateOpts>) -> GameState {
    let mut prng = seed_prng(seed.clone());
    match mode {
        GameMode::Unknown => {
            panic!("Unknown mode to seed");
        }
        GameMode::CargoRush => make_cargo_rush_state(seed, &mut prng, opts),
        GameMode::Tutorial => make_tutorial_state(&mut prng, opts),
        GameMode::Sandbox => make_sandbox_state(&mut prng, opts),
        GameMode::PirateDefence => make_pirate_defence_state(seed, &mut prng, opts),
    }
}

fn make_cargo_rush_state(
    seed: String,
    mut prng: &mut Pcg64Mcg,
    opts: Option<GenStateOpts>,
) -> GameState {
    let mut default_opts = GenStateOpts::default();
    default_opts.system_count = 5;
    let mut state = gen_state(seed, opts.unwrap_or(default_opts), &mut prng);
    init_all_planets_market(&mut state);
    state.id = prng_id(&mut prng);
    state.mode = GameMode::CargoRush;
    state
}

fn assign_health_to_planets(planets: &mut Vec<PlanetV2>, health: Health) {
    for mut planet in planets.into_iter() {
        planet.health = Some(health.clone())
    }
}

pub fn make_pirate_defence_state(
    seed: String,
    prng: &mut Pcg64Mcg,
    opts: Option<GenStateOpts>,
) -> GameState {
    let mut gen_opts = GenStateOpts::default();
    gen_opts.max_planets_in_system = 1;
    gen_opts.max_satellites_for_planet = 0;
    let mut state = gen_state(seed, opts.unwrap_or(gen_opts), prng);
    assign_health_to_planets(&mut state.locations[0].planets, Health::new(100.0));
    state.locations[0].planets[0]
        .properties
        .push(ObjectProperty::UnlandablePlanet);
    state.locations[0].planets[0]
        .properties
        .push(ObjectProperty::PirateDefencePlayersHomePlanet);
    state.milliseconds_remaining = 5 * 1000 * 60;
    state.mode = GameMode::PirateDefence;
    state
}

pub const DEFAULT_WORLD_UPDATE_EVERY_TICKS: u64 = 16 * 1000; // standard 60fps

fn make_tutorial_state(prng: &mut Pcg64Mcg, opts: Option<GenStateOpts>) -> GameState {
    let seed = "tutorial".to_owned();
    let now = Utc::now().timestamp_millis() as u64;

    let star_id = prng_id(prng);

    let star = Star {
        color: "rgb(100, 200, 85)".to_string(),
        corona_color: "rgb(100, 200, 85)".to_string(),
        spatial: SpatialProps {
            position: Vec2f64 {
                x: 0.0,
                y: 0.0,
            },
            rotation_rad: 0.0,
            radius: 30.0,
        },
        id: star_id.clone(),
        name: gen_star_name(prng).to_string(),
        movement: Movement::None,
    };

    let planet_id = prng_id(prng);
    let mut location = Location::new_empty(prng_id(prng));
    location.seed = seed.clone();
    location.star = Some(star);
    location.planets = vec![
        PlanetV2 {
            id: planet_id,
            name: "Schoolia".to_string(),

            spatial: SpatialProps {
                position: Vec2f64 {
                    x: 100.0,
                    y: 0.0,
                },
                rotation_rad: 0.0,
                radius: 8.0,
            },
            anchor_tier: 1,
            color: "#008FA9".to_string(),
            health: None,
            properties: Default::default(),
            movement: Movement::RadialMonotonous {
                full_period_ticks: 120.0 * 1000.0 * 1000.0,
                radius_to_anchor: 0.0,
                clockwise: false,
                anchor: ObjectSpecifier::Star {
                    id: star_id
                },
                relative_position: Default::default(),
                interpolation_hint: None,
            },
        },
        PlanetV2 {
            id: prng_id(prng),
            name: "Sat".to_string(),
            spatial: SpatialProps {
                position: Vec2f64 {
                    x: 120.0,
                    y: 0.0,
                },
                rotation_rad: 0.0,
                radius: 1.5,
            },
            anchor_tier: 2,
            color: "#1D334A".to_string(),
            health: None,
            properties: Default::default(),
            movement: Movement::RadialMonotonous {
                full_period_ticks: 20.0 * 1000.0 * 1000.0,
                radius_to_anchor: 0.0,
                clockwise: false,
                anchor: ObjectSpecifier::Planet {
                    id: planet_id
                },
                relative_position: Default::default(),
                interpolation_hint: None,
            },
        },
    ];

    GameState {
        id: prng_id(prng),
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
        ticks: 0,
        disable_hp_effects: false,
        market: Market::new(),
        interval_data: Default::default(),
        game_over: None,
        events: Default::default(),
        player_actions: Default::default(),
        processed_events: vec![],
        processed_player_actions: vec![],
        update_every_ticks: DEFAULT_WORLD_UPDATE_EVERY_TICKS,
        accumulated_not_updated_ticks: 0,
        gen_opts: opts.unwrap_or_default(),
        dialogue_states: Default::default(),
        breadcrumbs: vec![],
    }
}

pub fn make_sandbox_state(prng: &mut Pcg64Mcg, opts: Option<GenStateOpts>) -> GameState {
    let seed = "sandbox".to_owned();
    let now = Utc::now().timestamp_millis() as u64;

    GameState {
        id: prng_id(prng),
        version: GAME_STATE_VERSION,
        mode: GameMode::Sandbox,
        tag: None,
        seed: seed.clone(),
        my_id: Default::default(),
        start_time_ticks: now,
        locations: vec![Location::new_empty(prng_id(prng))],
        players: vec![],
        milliseconds_remaining: 99 * 60 * 1000,
        paused: false,
        leaderboard: None,
        millis: 0,
        ticks: 0,
        disable_hp_effects: true,
        market: Market::new(),
        interval_data: Default::default(),
        game_over: None,
        events: Default::default(),
        player_actions: Default::default(),
        processed_events: vec![],
        processed_player_actions: vec![],
        update_every_ticks: DEFAULT_WORLD_UPDATE_EVERY_TICKS,
        accumulated_not_updated_ticks: 0,
        gen_opts: opts.unwrap_or_default(),
        dialogue_states: Default::default(),
        breadcrumbs: vec![],
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct GenStateOpts {
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

fn gen_state(seed: String, opts: GenStateOpts, prng: &mut Pcg64Mcg) -> GameState {
    let mut locations = vec![];
    for _i in 0..opts.system_count {
        let loc_seed = random_hex_seed_seeded(prng);
        let location = gen_star_system_location(&loc_seed, &opts);
        locations.push(location);
    }
    wire_shake_locations(&mut locations, prng);
    let now = Utc::now().timestamp_millis() as u64;
    let state = GameState {
        id: prng_id(prng),
        seed: seed.clone(),
        tag: None,
        milliseconds_remaining: 3 * 60 * 1000,
        paused: false,
        my_id: Default::default(),
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
        player_actions: Default::default(),
        processed_events: vec![],
        ticks: 0,
        processed_player_actions: vec![],
        update_every_ticks: DEFAULT_WORLD_UPDATE_EVERY_TICKS,
        accumulated_not_updated_ticks: 0,
        gen_opts: opts,
        dialogue_states: Default::default(),
        breadcrumbs: vec![],
    };

    let mut state = validate_state(state);
    for _idx in 0..state.locations.len() {
        todo!("instead of seed time, implement random period hint shift");
        // state.locations[idx].planets = planets;
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

pub fn extract_valid_planets(in_state: &GameState, location_idx: usize) -> Vec<PlanetV2> {
    in_state.locations[location_idx]
        .planets
        .iter()
        .filter(|p| {
            let p_pos = p.spatial.position.clone();
            let check = p_pos.x.is_finite()
                && !p_pos.x.is_nan()
                && p_pos.y.is_finite()
                && !p_pos.y.is_nan()
                && p.spatial.rotation_rad.is_finite()
                && !p.spatial.rotation_rad.is_nan()
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
