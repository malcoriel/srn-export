#[cfg(test)]
mod world_test {
    use crate::world::{update_planets, GameState, Planet, Star};
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
            name: "sattelite".to_string(),
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
            my_id: Default::default(),
            star: Star {
                id: star_id,
                name: "star".to_string(),
                x: 0.0,
                y: 0.0,
                radius: 0.0,
                rotation: 0.0,
                color: "".to_string(),
            },
            planets: vec![planet, sat],
            ships: vec![],
            players: vec![],
            tick: 0,
        };
        let eps = 0.2;
        let new_planets = update_planets(
            &state.planets,
            &state.star,
            (1000.0 * 1000.0 * PI / 2.0) as i64,
        );

        let planet = &new_planets[0];
        let sat = &new_planets[1];
        eprintln!("planet {}/{}", planet.x, planet.y);
        eprintln!("sat {}/{}", sat.x, sat.y);
        assert!((planet.x - 0.0).abs() < eps);
        assert!((planet.y + 5.0).abs() < eps);
        assert!((sat.x - 2.0f64.sqrt() / 2.0).abs() < eps);
        assert!((sat.y + (5.0 + 2.0f64.sqrt() / 2.0)).abs() < eps);

        eprintln!("---------");

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
        eprintln!("planet {}/{}", planet.x, planet.y);
        eprintln!("sat {}/{}", sat.x, sat.y);

        assert!((planet.x - coord).abs() < eps);
        assert!((planet.y + coord).abs() < eps);
        assert!((sat.x - sat_x).abs() < eps);
        assert!((sat.y - sat_y).abs() < eps);
    }
}
