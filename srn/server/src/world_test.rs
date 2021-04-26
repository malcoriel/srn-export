#[cfg(test)]
mod world_test {
    use std::f64::consts::PI;

    use uuid::Uuid;

    use crate::new_id;
    use crate::planet_movement::update_planets;
    use crate::vec2::Vec2f64;
    use crate::world::{add_player, GameMode, seed_state, spawn_ship, update_ships_navigation, update_world, GameState, Planet, Star, UpdateOptions, AABB, Location};
    use crate::market::{Market};
    use crate::perf::Sampler;

    #[test]
    fn can_rotate_planets() {
        let star_id = Uuid::new_v4();
        let planet_id = Uuid::new_v4();
        let planet = Planet {
            id: planet_id,
            name: "planet".to_string(),
            x: 5.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 1.0,
            anchor_id: star_id,
            anchor_tier: 1,
            color: "".to_string(),
        };
        let sat = Planet {
            id: Uuid::new_v4(),
            name: "satellite".to_string(),
            x: 6.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.5,
            anchor_id: planet_id,
            anchor_tier: 2,
            color: "".to_string(),
        };
        let state = GameState {
            id: Default::default(),
            version: 0,
            mode: GameMode::CargoRush,
            tag: None,
            seed: "".to_string(),
            my_id: Default::default(),
            start_time_ticks: 0,
            locations: vec![
                Location {
                    star: Some(Star {
                        id: star_id,
                        name: "star".to_string(),
                        x: 0.0,
                        y: 0.0,
                        radius: 0.0,
                        rotation: 0.0,
                        color: "".to_string(),
                        corona_color: "".to_string()
                    }),
                    seed: "".to_string(),
                    planets: vec![planet, sat],
                    asteroids: vec![],
                    minerals: vec![],
                    asteroid_belts: vec![],
                    ships: vec![],
                }
            ],
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            ticks: 0,
            disable_hp_effects: false,
            market: Market {
                wares: Default::default(),
                prices: Default::default(),
                time_before_next_shake: 0
            }
        };
        let eps = 0.2;
        let location = &state.locations[0];
        let new_planets = update_planets(
            &location.planets,
            &location.star,
            (1000.0 * 1000.0 * PI / 2.0) as i64,
            Sampler::empty(),
            AABB::maxed(),
        ).0;

        let planet = &new_planets[0];
        let sat = &new_planets[1];
        assert!((planet.x - 0.0).abs() < eps);
        assert!((planet.y + 5.0).abs() < eps);
        assert!((sat.x - 2.0f64.sqrt() / 2.0).abs() < eps);
        assert!((sat.y + (5.0 + 2.0f64.sqrt() / 2.0)).abs() < eps);

        let coord = 2.0f64.sqrt() * 5.0 / 2.0;
        let sin_pi_8 = (PI / 8.0).sin();
        let cos_pi_8 = (PI / 8.0).cos();
        let sat_x = coord + cos_pi_8;
        let sat_y = -coord - sin_pi_8;

        let out = update_planets(
            &location.planets,
            &location.star,
            (1000.0 * 1000.0 * PI / 4.0) as i64,
            Sampler::empty(),
            AABB::maxed()
        );
        let new_planets = out.0;
        let planet = &new_planets[0];
        let sat = &new_planets[1];
        assert!((planet.x - coord).abs() < eps);
        assert!((planet.y + coord).abs() < eps);
        assert!((sat.x - sat_x).abs() < eps);
        assert!((sat.y - sat_y).abs() < eps);
    }

    #[test]
    fn can_ignore_planets() {
        let star_id = Uuid::new_v4();
        let planet_id = Uuid::new_v4();
        let planet = Planet {
            id: planet_id,
            name: "planet".to_string(),
            x: 5.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 1.0,
            anchor_id: star_id,
            anchor_tier: 1,
            color: "".to_string(),
        };
        let sat = Planet {
            id: Uuid::new_v4(),
            name: "satellite".to_string(),
            x: 6.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.5,
            anchor_id: planet_id,
            anchor_tier: 2,
            color: "".to_string(),
        };
        let state = GameState {
            id: Default::default(),
            version: 0,
            mode: GameMode::CargoRush,
            tag: None,
            seed: "".to_string(),
            my_id: Default::default(),
            start_time_ticks: 0,
            locations: vec![
                Location {
                    seed: "".to_string(),
                    star: Some(Star {
                        id: star_id,
                        name: "star".to_string(),
                        x: 0.0,
                        y: 0.0,
                        radius: 0.0,
                        rotation: 0.0,
                        color: "".to_string(),
                        corona_color: "".to_string(),
                    }),
                    planets: vec![planet, sat],
                    asteroids: vec![],
                    minerals: vec![],
                    asteroid_belts: vec![],
                    ships: vec![],

                }
            ],
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            ticks: 0,
            disable_hp_effects: false,
            market: Market {
                wares: Default::default(),
                prices: Default::default(),
                time_before_next_shake: 0
            }
        };
        let eps = 0.2;
        let location = &state.locations[0];
        let new_planets = update_planets(
            &location.planets,
            &location.star,
            (1000.0 * 1000.0 * PI / 2.0) as i64,
            Sampler::empty(),
            AABB {
                top_left: Vec2f64 {
                    x: 0.0,
                    y: -1.0,
                },
                bottom_right: Vec2f64 {
                    x: 5.5,
                    y: 1.0
                }
            },
        ).0;

        let planet = &new_planets[0];
        let sat = &new_planets[1];
        assert!((planet.x - 0.0).abs() < eps);
        assert!((planet.y + 5.0).abs() < eps);
        assert!((sat.x - 6.0).abs() < eps);
        assert!((sat.y - 0.0).abs() < eps);
    }

    #[test]
    fn can_pick_anchors_outside_limit_area() {
        let star_id = Uuid::new_v4();
        let planet_id = Uuid::new_v4();
        let planet = Planet {
            id: planet_id,
            name: "planet".to_string(),
            x: 5.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 1.0,
            anchor_id: star_id,
            anchor_tier: 1,
            color: "".to_string(),
        };
        let sat = Planet {
            id: Uuid::new_v4(),
            name: "satellite".to_string(),
            x: 6.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.5,
            anchor_id: planet_id,
            anchor_tier: 2,
            color: "".to_string(),
        };
        let state = GameState {
            id: Default::default(),
            version: 0,
            mode: GameMode::CargoRush,
            tag: None,
            seed: "".to_string(),
            my_id: Default::default(),
            start_time_ticks: 0,
            locations: vec![
                Location {
                    seed: "".to_string(),
                    star: Some(Star {
                        id: star_id,
                        name: "star".to_string(),
                        x: 0.0,
                        y: 0.0,
                        radius: 0.0,
                        rotation: 0.0,
                        color: "".to_string(),
                        corona_color: "".to_string()
                    }),
                    planets: vec![planet, sat],
                    asteroids: vec![],
                    minerals: vec![],
                    asteroid_belts: vec![],
                    ships: vec![],
                }
            ],
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            ticks: 0,
            disable_hp_effects: false,
            market: Market {
                wares: Default::default(),
                prices: Default::default(),
                time_before_next_shake: 0
            }
        };
        let eps = 0.2;
        let location = &state.locations[0];
        let new_planets = update_planets(
            &location.planets,
            &location.star,
            (1000.0 * 1000.0 * PI / 2.0) as i64,
            Sampler::empty(),
            AABB {
                top_left: Vec2f64 {
                    x: 5.5,
                    y: -1.0,
                },
                bottom_right: Vec2f64 {
                    x: 6.5,
                    y: 1.0
                }
            },
        ).0;

        let planet = &new_planets[0];
        let sat = &new_planets[1];
        assert_eq!(new_planets.len(), 2);
        assert!((planet.x - 0.0).abs() < eps);
        assert!((planet.y + 5.0).abs() < eps);
        assert!((sat.x - 2.0f64.sqrt() / 2.0).abs() < eps);
        assert!((sat.y + (5.0 + 2.0f64.sqrt() / 2.0)).abs() < eps);
    }

    #[test]
    pub fn can_navigate_ships_to_points() {
        let eps = 0.1;
        let dist = 20.0;

        let both_client_and_server = vec![false, true];
        for is_client in both_client_and_server.into_iter() {
            let mut state = seed_state(false, false);
            let player_id = crate::new_id();
            add_player(&mut state, player_id, false, None);
            spawn_ship(&mut state, player_id, Some(Vec2f64::zero()));
            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: dist, y: dist });

            let options = UpdateOptions { disable_hp_effects: true, limit_area: AABB::maxed() };
            let (state, _sampler) = update_world(state, 1 * 1000, is_client,
                                                 Sampler::empty(), options.clone());
            let ship = &state.ships[0];
            eprintln!("No change ship {}/{}", ship.x, ship.y);
            assert!((ship.x).abs() < eps);
            assert!((ship.y).abs() < eps);
            assert!(ship.navigate_target.is_some());

            let (state, _sampler) = update_world(state, 1000 * 1000, is_client, Sampler::empty(), options.clone());
            let ship = &state.ships[0];
            let expected_pos = 2.0f64.sqrt() / 2.0 * dist;
            assert!((ship.x - expected_pos).abs() < eps);
            assert!((ship.y - expected_pos).abs() < eps);
            assert!(ship.navigate_target.is_some());

            let (state, _sampler) = update_world(state, 3 * 1000 * 1000, is_client, Sampler::empty(), options.clone());
            let ship = &state.ships[0];
            assert!((ship.x - dist).abs() < eps);
            assert!((ship.y - dist).abs() < eps);
            assert!(ship.navigate_target.is_none());
        }
    }

    #[test]
    pub fn can_rotate_while_navigating() {
        let eps = 0.01;
        let dist = 10.0;

        for is_client in vec![false, true].into_iter() {
            let mut state = seed_state(false, false);
            let player_id = crate::new_id();
            add_player(&mut state, player_id, false, None);
            spawn_ship(&mut state, player_id, Some(Vec2f64::zero()));
            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: dist, y: dist });
            let options = UpdateOptions { disable_hp_effects: true, limit_area: AABB::maxed() };

            let (mut state, _sampler) = update_world(state, 1 * 1000, is_client, Sampler::empty(), options.clone());
            let ship = &mut state.ships[0];
            let expected = PI * 0.75;
            //eprintln!("rotation {} vs {}", ship.rotation, expected);
            assert!((ship.rotation - expected).abs() < eps);

            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: -dist, y: -dist });
            let (mut state, _sampler) = update_world(state, 1 * 1000, is_client, Sampler::empty(), options.clone());
            let ship = &mut state.ships[0];
            let expected = PI * 0.25;
            //eprintln!("rotation {} vs -{}", ship.rotation, expected);
            assert!((ship.rotation + expected).abs() < eps);

            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: -dist, y: dist });
            let (mut state, _sampler) = update_world(state, 1 * 1000, is_client, Sampler::empty(), options.clone());
            let ship = &mut state.ships[0];
            let expected = PI * 0.75;
            //eprintln!("rotation {} vs -{}", ship.rotation, expected);
            assert!((ship.rotation + expected).abs() < eps)
        }
    }

    pub fn iterate_state(mut state: GameState, time: i64, step: i64, client: bool) -> GameState {
        let mut elapsed = 0;
        let options = UpdateOptions { disable_hp_effects: true, limit_area: AABB::maxed() };

        loop {
            if elapsed >= time {
                break;
            }
            elapsed += step;
            let (state_out, _sampler) = update_world(state, step, client, Sampler::empty(), options.clone());
            state = state_out;
        }
        state
    }

    #[test]
    pub fn can_navigate_ships_to_docking() {
        let eps = 0.1;
        let dist = 50.0;

        let both_client_and_server = vec![false]; // true
        for is_client in both_client_and_server.into_iter() {
            let mut state = seed_state(false, false);
            let player_id = crate::new_id();
            add_player(&mut state, player_id, false, None);
            spawn_ship(&mut state, player_id, Some(Vec2f64::zero()));
            let star = state.star.clone().unwrap();
            let planet_id = new_id();
            state.planets = vec![
                Planet {
                    id: planet_id,
                    name: "".to_string(),
                    x: dist,
                    y: 0.0,
                    rotation: 0.0,
                    radius: 3.0,
                    orbit_speed: PI / 20.0,
                    anchor_id: star.id.clone(),
                    anchor_tier: 1,
                    color: "".to_string(),
                },
                Planet {
                    id: new_id(),
                    name: "".to_string(),
                    x: -dist,
                    y: 0.0,
                    rotation: 0.0,
                    radius: 3.0,
                    orbit_speed: PI / 20.0,
                    anchor_id: star.id.clone(),
                    anchor_tier: 1,
                    color: "".to_string(),
                },
            ];
            let mut ship = &mut state.ships[0];
            ship.dock_target = Some(planet_id);

            state = iterate_state(state, 10000 * 1000, 500, is_client);
            let planet = &state.planets[0];
            let ship = &state.ships[0];
            // eprintln!("result: ship {}/{}, {:?}", ship.x, ship.y, ship.trajectory);
            // eprintln!("result: planet {}/{}", planet.x, planet.y);

            assert!((planet.x - 0.0).abs() < eps);
            assert!((planet.y + 50.0).abs() < eps);
            assert!((ship.x - 0.0).abs() < planet.radius);
            assert!((ship.y + 50.0).abs() < planet.radius);
        }
    }
}
