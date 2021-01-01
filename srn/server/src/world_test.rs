#[cfg(test)]
mod world_test {
    use crate::vec2::Vec2f64;
    use crate::world::{
        add_player, seed_state, spawn_ship, update, update_planets, update_ships_navigation,
        GameState, Planet, Star,
    };
    use std::f64::consts::PI;
    use uuid::Uuid;

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
            tag: None,
            my_id: Default::default(),
            start_time_ticks: 0,
            star: Some(Star {
                id: star_id,
                name: "star".to_string(),
                x: 0.0,
                y: 0.0,
                radius: 0.0,
                rotation: 0.0,
                color: "".to_string(),
            }),
            planets: vec![planet, sat],
            ships: vec![],
            players: vec![],
            milliseconds_remaining: 0,
            paused: false,
            leaderboard: None,
            ticks: 0,
        };
        let eps = 0.2;
        let new_planets = update_planets(
            &state.planets,
            &state.star,
            (1000.0 * 1000.0 * PI / 2.0) as i64,
        );

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

        let new_planets = update_planets(
            &state.planets,
            &state.star,
            (1000.0 * 1000.0 * PI / 4.0) as i64,
        );
        let planet = &new_planets[0];
        let sat = &new_planets[1];
        assert!((planet.x - coord).abs() < eps);
        assert!((planet.y + coord).abs() < eps);
        assert!((sat.x - sat_x).abs() < eps);
        assert!((sat.y - sat_y).abs() < eps);
    }

    #[test]
    pub fn can_navigate_ships() {
        let eps = 0.1;
        let dist = 10.0;

        let both_client_and_server = vec![false, true];
        for is_client in both_client_and_server.into_iter() {
            let mut state = seed_state(false);
            let player_id = crate::new_id();
            add_player(&mut state, &player_id);
            spawn_ship(&mut state, &player_id);
            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: dist, y: dist });

            state = update(state, 1 * 1000, is_client);
            let ship = &state.ships[0];
            assert!((ship.x).abs() < eps);
            assert!((ship.y).abs() < eps);
            assert!(ship.navigate_target.is_some());

            state = update(state, 1000 * 1000, is_client);
            let ship = &state.ships[0];
            let expected_pos = 2.0f64.sqrt() / 2.0 * dist;
            assert!((ship.x - expected_pos).abs() < eps);
            assert!((ship.y - expected_pos).abs() < eps);
            assert!(ship.navigate_target.is_some());

            state = update(state, 3 * 1000 * 1000, is_client);
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
            let mut state = seed_state(false);
            let player_id = crate::new_id();
            add_player(&mut state, &player_id);
            spawn_ship(&mut state, &player_id);
            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: dist, y: dist });
            state = update(state, 1 * 1000, is_client);
            let ship = &mut state.ships[0];
            let expected = PI * 0.75;
            eprintln!("rotation {} vs {}", ship.rotation, expected);
            assert!((ship.rotation - expected).abs() < eps);

            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: -dist, y: -dist });
            state = update(state, 1 * 1000, is_client);
            let ship = &mut state.ships[0];
            let expected = PI * 0.25;
            eprintln!("rotation {} vs -{}", ship.rotation, expected);
            assert!((ship.rotation + expected).abs() < eps);

            let mut ship = &mut state.ships[0];
            ship.navigate_target = Some(Vec2f64 { x: -dist, y: dist });
            state = update(state, 1 * 1000, is_client);
            let ship = &mut state.ships[0];
            let expected = PI * 0.75;
            eprintln!("rotation {} vs -{}", ship.rotation, expected);
            assert!((ship.rotation + expected).abs() < eps)
        }
    }
}
