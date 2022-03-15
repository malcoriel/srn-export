use crate::planet_movement::{IBody, IBodyV2};
use crate::vec2::{Precision, Vec2f64};
use crate::world::{lerp, Location, Movement, Planet, PlanetV2, Ship};
use crate::GameState;
use std::collections::HashMap;
use std::f64::consts::PI;
use std::mem;
use std::str::FromStr;
use uuid::Uuid;

pub fn interpolate_states(
    state_a: &GameState,
    state_b: &GameState,
    value: f64,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
) -> GameState {
    let mut result = state_a.clone();
    for i in 0..result.locations.len() {
        let res = &mut result.locations[i];
        if let Some(target) = state_b.locations.get(i) {
            interpolate_location(res, target, value, rel_orbit_cache);
        }
    }
    result
}

fn interpolate_location(
    result: &mut Location,
    target: &Location,
    value: f64,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
) {
    for i in 0..result.ships.len() {
        let ship = &mut result.ships[i];
        if let Some(target) = target.ships.get(i) {
            interpolate_ship(ship, target, value);
        }
    }

    let mut movements = vec![];
    // in order to avoid tiers, instead calculate all relative positions via casting to v2
    // ideally, this should not happen - but will only be possible once I migrate actual state to v2 and do
    // the movement via same interpolation algorithm
    for i in 0..result.planets.len() {
        if let Some(target_p) = target.planets.get(i) {
            movements.push((
                PlanetV2::from(&result.planets[i], result).movement,
                PlanetV2::from(target_p, target).movement,
            ));
        }
    }

    // then interpolate
    for i in 0..movements.len() {
        let (res_mov, tar_mov) = &mut movements[i];
        interpolate_planet_relative_movement(res_mov, tar_mov, value, rel_orbit_cache);
    }
    // then, sequentially (via tiers) restore absolute position
    let mut anchor_pos_by_id = HashMap::new();
    let star_clone = result.star.clone().unwrap();
    anchor_pos_by_id.insert(star_clone.id, star_clone.as_vec());
    for tier in 1..3 {
        for i in 0..result.planets.len() {
            let planet = &mut result.planets[i];
            if planet.anchor_tier == tier {
                let new_pos = match movements[i].0 {
                    Movement::RadialMonotonous {
                        relative_position, ..
                    } => relative_position,
                    _ => panic!("bad movement"),
                }
                .add(&anchor_pos_by_id.get(&planet.anchor_id).unwrap());
                anchor_pos_by_id.insert(planet.id, new_pos.clone());
                planet.x = new_pos.x;
                planet.y = new_pos.y;
            }
        }
    }
}

pub const REL_ORBIT_CACHE_KEY_PRECISION: f64 = 1.0e14;

fn interpolate_planet_relative_movement(
    result: &mut Movement,
    target: &Movement,
    value: f64,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
) {
    let res_clone = result.clone();
    let (radius_key, mut interpolation_hint_result, result_pos) = match result {
        Movement::RadialMonotonous {
            radius_to_anchor,
            interpolation_hint,
            relative_position,
            ..
        } => (
            radius_to_anchor,
            interpolation_hint.map(|v| v as usize),
            relative_position,
        ),
        _ => panic!("bad movement"),
    };
    let (mut interpolation_hint_target, target_pos) = match target {
        Movement::RadialMonotonous {
            interpolation_hint,
            relative_position,
            ..
        } => (interpolation_hint.map(|v| v as usize), relative_position),
        _ => panic!("bad movement"),
    };

    let phase_table = rel_orbit_cache
        .entry((*radius_key * REL_ORBIT_CACHE_KEY_PRECISION) as u64)
        .or_insert_with(|| get_rel_position_phase_table(&res_clone));
    let result_idx = interpolation_hint_result.unwrap_or_else(|| {
        calculate_hint(&phase_table, result_pos).expect("could not calculate hint")
    });
    let target_idx = interpolation_hint_target.unwrap_or_else(|| {
        calculate_hint(&phase_table, target_pos).expect("could not calculate hint")
    });
    let lerped_idx = lerp_usize_cycle(result_idx, target_idx, value, phase_table.len());
    // log!(format!(
    //     "own rel pos after calculation {} lerped_idx/total {lerped_idx}/{} result/target idx {result_idx}/{target_idx}",
    //     phase_table[lerped_idx],
    //     phase_table.len(),
    // ));
    match result {
        Movement::RadialMonotonous {
            relative_position, ..
        } => {
            *relative_position = phase_table[lerped_idx];
        }
        _ => panic!("bad movement"),
    }
}

// assume that the table is a set of sequential circle coordinates
fn calculate_hint(table: &Vec<Vec2f64>, pos: &Vec2f64) -> Option<usize> {
    // this can be further optimized by using binary search and not calculating every single distance
    let mut current_distance = 9999.0;
    let mut index = None;
    for i in 0..table.len() {
        let dist = table[i].euclidean_distance(pos);
        if dist < current_distance {
            index = Some(i);
            current_distance = dist;
        }
    }
    index
}

fn lerp_usize(from: usize, to: usize, value: f64) -> usize {
    lerp(from as f64, to as f64, value) as usize
}

fn lerp_usize_cycle(from: usize, to: usize, value: f64, max: usize) -> usize {
    if (to as i32 - from as i32).abs() as usize > max / 2 {
        (lerp((from + max) as f64, to as f64, value) as usize) % max
    } else {
        lerp(from as f64, to as f64, value) as usize
    }
}

pub const IDEAL_RELATIVE_ROTATION_PRECISION_MULTIPLIER: f64 = 100.0;
pub const REALISTIC_RELATIVE_ROTATION_PRECISION_DIVIDER: f64 = 32000.0;

// build a list of coordinates of the linear (segment) approximation of the circle, where every point
// is a vertex of the resulting polygon, in an assumption that precision is enough (subdivided to enough amount of points)
// so lerp(A,B) =~ the real circle point with some precision, but at the same time as low as possible
fn get_rel_position_phase_table(def: &Movement) -> Vec<Vec2f64> {
    // log!(format!("calculate call {def:?}"));
    match def {
        Movement::RadialMonotonous {
            full_period_ticks,
            radius_to_anchor,
            clockwise,
            ..
        } => {
            let mut res = vec![];
            let ideal_amount = radius_to_anchor * IDEAL_RELATIVE_ROTATION_PRECISION_MULTIPLIER; // completely arbitrary for now, without targeting specific precision
            let amount_from_period = *full_period_ticks; // every tick is a point. However, it's super-unlikely that I will ever have an update every tick, and even every cycle of 16ms is unnecessary
            let realistic_amount =
                amount_from_period / REALISTIC_RELATIVE_ROTATION_PRECISION_DIVIDER; // precision with 1ms is probably fine-grained enough, equivalent to every 2 cycles of 16ms

            let mut chosen_amount: usize = {
                if ideal_amount < realistic_amount {
                    // no need to be more precise than the heuristic
                    ideal_amount as usize
                } else {
                    if realistic_amount < 0.5 * ideal_amount {
                        // this is bad, and will lead to horrible visual artifacts likely, so will reuse the ideal * 0.5 instead
                        (0.5 * ideal_amount) as usize
                    } else {
                        // if realistic is between 0.5 and 1.0 of ideal, this is probably fine
                        realistic_amount as usize
                    }
                }
            };
            if chosen_amount % 2 > 0 {
                chosen_amount += 1; // make even
            }
            let angle_step_rad = PI * 2.0 / chosen_amount as f64;
            let sign = if *clockwise { -1.0 } else { 1.0 };
            for i in 0..chosen_amount {
                let angle = i as f64 * angle_step_rad;
                let x = angle.cos() * radius_to_anchor;
                let y = angle.sin() * radius_to_anchor * sign;
                res.push(Vec2f64 { x, y });
            }
            res
        }
        _ => panic!("bad movement"),
    }
}

fn interpolate_ship(result: &mut Ship, target: &Ship, value: f64) {
    result.x = lerp(result.x, target.x, value);
    result.y = lerp(result.y, target.y, value);
}
