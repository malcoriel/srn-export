use crate::game::Planet;
use crate::vec2::{angle_rad, rotate, Vec2f64};
use crate::DEBUG_PHYSICS;
use std::f64::consts::PI;

pub fn update_planets(planets: &Vec<Planet>, elapsed_micro: i64) -> Vec<Planet> {
    planets
        .iter()
        .map(|p| {
            if DEBUG_PHYSICS {
                println!("p {} elapsed {}", p.id, elapsed_micro);
            }
            let mut p = p.clone();
            let current_pos = Vec2f64 { x: p.x, y: p.y };
            if DEBUG_PHYSICS {
                println!("old {}", current_pos);
            }

            let orbit_length = current_pos.euclidean_distance(&Vec2f64 { x: 0.0, y: 0.0 });
            let base_vec = Vec2f64 {
                x: orbit_length,
                y: 0.0,
            };
            let mut current_angle = angle_rad(base_vec.clone(), current_pos);
            if current_pos.y > 0.0 {
                current_angle = 2.0 * PI - current_angle;
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
            p.x = new_vec.x;
            p.y = new_vec.y;
            if DEBUG_PHYSICS {
                println!("new {}", new_vec);
            }
            return p;
        })
        .collect::<Vec<Planet>>()
}
