use crate::new_id;
use crate::random_stuff::{
    gen_color, gen_planet_count, gen_planet_orbit_speed, gen_planet_radius, gen_sat_count,
    gen_sat_gap, gen_sat_orbit_speed, gen_sat_radius, gen_star_name, gen_star_radius, PLANET_NAMES,
    SAT_NAMES,
};
use crate::world::{AsteroidBelt, GameState, Planet, Star};
use chrono::Utc;
use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use std::collections::VecDeque;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use uuid::Uuid;

struct PoolRandomPicker<T> {
    options: Vec<T>,
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

pub fn system_gen(seed: String) -> GameState {
    let star_id = crate::new_id();
    let mut prng = SmallRng::seed_from_u64(str_to_hash(seed.clone()));

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

    eprintln!("zones {:?}", zones);

    let planet_count = zones.len() / 2;
    let asteroid_index = if planet_count % 2 == 0 {
        planet_count - 2
    } else {
        planet_count - 1
    };
    eprintln!(
        "planets {}, asteroid_index {}",
        planet_count, asteroid_index
    );

    let mut planets = vec![];
    let mut asteroid_belts = vec![];

    let star_zone = zones.pop_front().unwrap();

    let star = Star {
        color: "rgb(200, 150, 65)".to_string(),
        id: star_id.clone(),
        name: gen_star_name(&mut prng).to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: star_zone.0,
    };

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
                    let planet = Planet {
                        id: planet_id,
                        name,
                        x: planet_center_x,
                        y: 0.0,
                        rotation: 0.0,
                        radius: planet_radius,
                        orbit_speed: gen_planet_orbit_speed(&mut prng) / (index + 1) as f64,
                        anchor_id: star.id.clone(),
                        anchor_tier: 1,
                        color: gen_color(&mut prng).to_string(),
                    };
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

    let now = Utc::now().timestamp_millis() as u64;
    let state = GameState {
        id: new_id(),
        seed,
        tag: None,
        milliseconds_remaining: 3 * 60 * 1000,
        paused: false,
        my_id: new_id(),
        ticks: 0,
        asteroids: vec![],
        star: Some(star),
        planets,
        ships: vec![],
        players: vec![],
        leaderboard: None,
        start_time_ticks: now,
        asteroid_belts,
        minerals: vec![],
    };
    state
}


pub fn make_tutorial_state(client_id: Uuid) -> GameState {
    let seed = "tutorial".to_owned();
    let now = Utc::now().timestamp_millis() as u64;

    let mut prng = SmallRng::seed_from_u64(str_to_hash(seed.clone()));
    let star_id = new_id();

    let star = Star {
        color: "rgb(100, 200, 85)".to_string(),
        id: star_id.clone(),
        name: gen_star_name(&mut prng).to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: 30.0,
    };

    GameState {
        id: client_id,
        tag: None,
        seed,
        my_id: Default::default(),
        start_time_ticks: now,
        star: Some(star),
        planets: vec![Planet {
            id: new_id(),
            name: "Schoolia".to_string(),
            x: 100.0,
            y: 0.0,
            rotation: 0.0,
            radius: 5.0,
            orbit_speed: 0.005,
            anchor_id: star_id.clone(),
            anchor_tier: 1,
            color: "#11ffff".to_string()
        }],
        asteroids: vec![],
        minerals: vec![],
        asteroid_belts: vec![],
        ships: vec![],
        players: vec![],
        milliseconds_remaining: 60 * 1000,
        paused: false,
        leaderboard: None,
        ticks: 0
    }
}
