use crate::game::{Planet, Star};
use crate::vec2::{angle_rad, rotate, AsVec2f64, Precision, Vec2f64};
use crate::DEBUG_PHYSICS;
use std::collections::HashMap;
use std::f64::consts::PI;

pub fn update_planets(planets: &Vec<Planet>, star: &Star, elapsed_micro: i64) -> Vec<Planet> {
    let planet_star = Planet {
        name: star.name.clone(),
        id: star.id,
        x: star.x,
        y: star.y,
        rotation: star.rotation,
        radius: star.radius,
        orbit_speed: 0.0,
        anchor_id: Default::default(),
        anchor_tier: 0,
    };
    let by_id = {
        let mut by_id = HashMap::new();
        for p in planets.iter() {
            by_id.entry(p.id).or_insert(p);
        }
        by_id.insert(star.id, &planet_star);
        by_id
    };
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
