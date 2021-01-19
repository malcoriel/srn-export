use std::collections::HashMap;

use crate::vec2::{angle_rad, rotate, AsVec2f64, Precision, Vec2f64};
use crate::world;
use crate::world::{
    build_anchors_from_planets, index_planets_by_id, make_planets_with_star, Planet, Star,
};
use crate::DEBUG_PHYSICS;
use std::f64::consts::PI;
use uuid::Uuid;

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

pub fn simulate_planet_movement(
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
