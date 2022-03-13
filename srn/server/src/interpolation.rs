use crate::planet_movement::{IBody, IBodyV2};
use crate::vec2::{Precision, Vec2f64};
use crate::world::{lerp, Location, MovementDefinition, Planet, PlanetV2, Ship};
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
    let read_loc_copy = result.clone();
    for i in 0..result.ships.len() {
        let ship = &mut result.ships[i];
        if let Some(target) = target.ships.get(i) {
            interpolate_ship(ship, target, value);
        }
    }
    for i in 0..result.planets.len() {
        let planet = &mut result.planets[i];
        if let Some(target) = target.planets.get(i) {
            interpolate_planet(planet, target, value, &read_loc_copy, rel_orbit_cache);
        }
    }
}

fn interpolate_planet(
    result: &mut Planet,
    target: &Planet,
    value: f64,
    loc: &Location,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
) {
    let mut res_v2 = PlanetV2::from(result, loc);
    let tar_v2 = PlanetV2::from(target, loc);
    let anchor = tar_v2.get_anchor_ref(loc);
    interpolate_planet_v2(&mut res_v2, &tar_v2, value, anchor, rel_orbit_cache);
    mem::swap(
        &mut Planet::from_pv2(&res_v2, loc.star.as_ref().map(|s| s.id.clone()).unwrap()),
        result,
    );
}

fn interpolate_planet_v2(
    result: &mut PlanetV2,
    target: &PlanetV2,
    value: f64,
    anchor: Box<&dyn IBody>,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
) {
    let radius_key = match result.movement {
        MovementDefinition::RadialMonotonous {
            radius_to_anchor, ..
        } => radius_to_anchor,
        _ => panic!(
            "Cannot interpolate without radius movement for id {}, movement = {:?}",
            result.id, result.movement
        ),
    };
    let phase_table = rel_orbit_cache
        .entry((radius_key * 1.0e14) as u64)
        .or_insert_with(|| get_rel_position_phase_table(&result.movement, result.id));
    let result_idx = result.spatial.interpolation_hint.unwrap_or_else(|| {
        calculate_hint(&phase_table, Box::new(result)).expect("could not calculate hint")
    });
    let target_idx = target.spatial.interpolation_hint.unwrap_or_else(|| {
        calculate_hint(&phase_table, Box::new(target)).expect("could not calculate hint")
    });
    let lerped_idx = lerp_usize(result_idx, target_idx, value);
    let pos = Vec2f64 {
        x: ((**anchor).get_x()),
        y: ((**anchor).get_y()),
    };
    result.spatial.position = phase_table[lerped_idx].add(&pos);
}

// assume that the table is a set of sequential circle coordinates
fn calculate_hint(table: &Vec<Vec2f64>, planet: Box<&dyn IBodyV2>) -> Option<usize> {
    let pos = &planet.get_spatial().position;
    // this can be further optimized by using binary search and not calculating every single distance
    let mut current_distance = 9999.0;
    let mut index = None;
    for i in 0..table.len() {
        let point = &table[i];
        let dist = point.euclidean_distance(pos);
        if dist < current_distance {
            index = Some(i);
            current_distance = dist;
        }
    }
    index
}

fn lerp_usize(from: usize, to: usize, value: f64) -> usize {
    let double_val = lerp(from as f64, to as f64, value);
    double_val as usize
}

pub const IDEAL_RELATIVE_ROTATION_PRECISION_MULTIPLIER: f64 = 100.0;
pub const REALISTIC_RELATIVE_ROTATION_PRECISION_DIVIDER: f64 = 32000.0;

// build a list of coordinates of the linear (segment) approximation of the circle, where every point
// is a vertex of the resulting polygon, in an assumption that precision is enough (subdivided to enough amount of points)
// so lerp(A,B) =~ the real circle point with some precision, but at the same time as low as possible
fn get_rel_position_phase_table(def: &MovementDefinition, for_id: Uuid) -> Vec<Vec2f64> {
    // log!(format!("calculate call {def:?} for id {for_id}"));
    match def {
        MovementDefinition::RadialMonotonous {
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

            let chosen_amount: usize = {
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
        _ => panic!("Unsupported movement definition {def} for id {for_id}"),
    }
}

fn interpolate_ship(result: &mut Ship, target: &Ship, value: f64) {
    result.x = lerp(result.x, target.x, value);
    result.y = lerp(result.y, target.y, value);
}
