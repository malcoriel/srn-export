use crate::indexing::{
    index_all_ships_by_id, index_ships_by_id, index_state, GameStateIndexes, ObjectSpecifier, Spec,
};
use crate::planet_movement::IBodyV2;
use crate::vec2::{Precision, Vec2f64};
use crate::world::{
    lerp, GameState, Location, Movement, PlanetV2, RotationMovement, Ship, UpdateOptionsV2, AABB,
};
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
    options: UpdateOptionsV2,
) -> GameState {
    let mut result = state_a.clone();
    let result_indexes = index_state(&state_a);
    let target_indexes = index_state(&state_b);
    interpolate_timings(&mut result, state_b, value);
    for i in 0..result.locations.len() {
        if let Some(limit_to_loc_idx) = &options.limit_to_loc_idx {
            if *limit_to_loc_idx != i {
                continue;
            }
        }
        let res = &mut result.locations[i];
        if let Some(target) = state_b.locations.get(i) {
            interpolate_location(
                res,
                target,
                value,
                rel_orbit_cache,
                &options,
                &result_indexes,
                &target_indexes,
            );
        }
    }
    result
}

fn interpolate_timings(result: &mut GameState, target: &GameState, value: f64) {
    let ticks_f64 = result.ticks as f64 + ((target.ticks as f64 - result.ticks as f64) * value);
    let old_millis = result.millis;
    result.ticks = ticks_f64 as u64;
    result.millis = (ticks_f64 / 1000.0) as u32;
    let elapsed_ms = result.millis as i32 - old_millis as i32;
    result.milliseconds_remaining -= elapsed_ms;
}

fn interpolate_location(
    result: &mut Location,
    target: &Location,
    value: f64,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
    options: &UpdateOptionsV2,
    result_indexes: &GameStateIndexes,
    target_indexes: &GameStateIndexes,
) {
    let ships_by_id_target = index_ships_by_id(target);
    for i in 0..result.ships.len() {
        let ship = &mut result.ships[i];
        if let Some(target) = ships_by_id_target.get(&ship.id) {
            if should_skip_pos(&options, &ship.as_vec()) {
                continue;
            }
            interpolate_ship(ship, target, value);
        }
    }

    // interpolate
    for i in 0..result.planets.len() {
        let planet_spec = result.planets[i].spec();
        let planet_pos = result.planets[i].spatial.position;
        let planet_pos_target = target.planets[i].spatial.position;
        let should_skip = should_skip_pos(&options, &planet_pos);
        let res_mov = &mut result.planets[i].movement;
        let tar_mov = &target.planets[i].movement;
        if !should_skip {
            interpolate_planet_relative_movement(
                res_mov,
                tar_mov,
                value,
                rel_orbit_cache,
                result_indexes,
                &planet_spec,
                &planet_pos,
                &planet_pos_target,
                target_indexes,
            );
        } else {
            // log!(format!("skipping {}", i));
        }
    }

    // then, sequentially (via tiers) restore absolute position
    let star_clone = &result.star.clone();
    if let Some(star_clone) = star_clone {
        let star_root: Box<&dyn IBodyV2> = Box::new(star_clone as &dyn IBodyV2);
        restore_absolute_positions(
            star_root,
            result
                .planets
                .iter_mut()
                .map(|p| Box::new(p as &mut dyn IBodyV2))
                .collect(),
        )
    }
}

pub fn restore_absolute_positions(root: Box<&dyn IBodyV2>, mut bodies: Vec<Box<&mut dyn IBodyV2>>) {
    let mut anchor_pos_by_id = HashMap::new();
    anchor_pos_by_id.insert(root.get_id(), root.get_spatial().position.clone());
    for tier in 1..3 {
        for i in 0..bodies.len() {
            let mov_0 = bodies[i].get_movement().clone();
            let body = bodies[i].as_mut();
            if body.get_anchor_tier() == tier {
                let new_pos = match mov_0 {
                    Movement::RadialMonotonous {
                        relative_position, ..
                    } => relative_position,
                    _ => panic!("bad movement"),
                }
                .expect("cannot restore absolute position on empty relative position, bailing out")
                .add(
                    &anchor_pos_by_id
                        .get(&body.get_movement().get_anchor_id())
                        .unwrap(),
                );
                anchor_pos_by_id.insert(body.get_id(), new_pos.clone());
                body.get_spatial_mut().position.x = new_pos.x;
                body.get_spatial_mut().position.y = new_pos.y;
            }
        }
    }
}

fn should_skip_pos(options: &&UpdateOptionsV2, pos_to_skip: &Vec2f64) -> bool {
    if let Some(limit_area) = &options.limit_area {
        if !limit_area.contains_vec(&pos_to_skip) {
            return true;
        }
    }
    return false;
}

pub const REL_ORBIT_CACHE_KEY_PRECISION: f64 = 1.0e14;

fn interpolate_planet_relative_movement(
    result: &mut Movement,
    target: &Movement,
    value: f64,
    rel_orbit_cache: &mut HashMap<u64, Vec<Vec2f64>>,
    result_indexes: &GameStateIndexes,
    planet_spec: &ObjectSpecifier,
    planet_pos_result: &Vec2f64,
    planet_pos_target: &Vec2f64,
    target_indexes: &GameStateIndexes,
) {
    let mut res_fixed = result.clone();
    try_restore_relative_position(&mut res_fixed, planet_pos_result, result_indexes);
    let mut target_fixed = target.clone();
    try_restore_relative_position(&mut target_fixed, planet_pos_target, target_indexes);

    let (interpolation_hint_result, result_pos) = match res_fixed.clone() {
        Movement::RadialMonotonous {
            phase,
            relative_position,
            ..
        } => (
            phase.map(|v| v as usize),
            relative_position.unwrap(), // try_restore guarantees not-null
        ),
        _ => panic!("bad movement"),
    };
    let (interpolation_hint_target, target_pos) = match target_fixed.clone() {
        Movement::RadialMonotonous {
            phase: interpolation_hint,
            relative_position,
            ..
        } => (
            interpolation_hint.map(|v| v as usize),
            relative_position.unwrap(), // try_restore guarantees not-null
        ),
        _ => panic!("bad movement"),
    };

    let radius_to_anchor = result_indexes
        .anchor_distances
        .get(&planet_spec)
        .expect(format!("no anchor distance in cache for {:?}", planet_spec).as_str());
    let phase_table = get_orbit_phase_table(rel_orbit_cache, &res_fixed, *radius_to_anchor);
    let result_idx = interpolation_hint_result.unwrap_or_else(|| {
        calculate_phase(&phase_table, &result_pos).expect("could not calculate phase hint")
    });
    let target_idx = interpolation_hint_target.unwrap_or_else(|| {
        calculate_phase(&phase_table, &target_pos).expect("could not calculate phase hint")
    });
    let lerped_idx = lerp_usize_cycle(result_idx, target_idx, value, phase_table.len());
    // log!(format!(
    //     "values near -1={} +1={}",
    //     phase_table[lerped_idx - 1],
    //     phase_table[lerped_idx + 1]
    // ));
    // log!(format!(
    //     "own rel pos after calculation {} lerped_idx/total {lerped_idx}/{} result/target idx {result_idx}/{target_idx}",
    //     phase_table[lerped_idx],
    //     phase_table.len(),
    // ));
    match result {
        Movement::RadialMonotonous {
            relative_position, ..
        } => {
            *relative_position = Some(phase_table[lerped_idx]);
        }
        _ => panic!("bad movement"),
    }
}

fn recalculate_relative_position(
    movement: &Movement,
    absolute_position: &Vec2f64,
    indexes: &GameStateIndexes,
) -> Vec2f64 {
    let anchor_spatial = indexes
        .bodies_by_id
        .get(&movement.get_anchor_spec())
        .expect("cannot restore relative position without an anchor")
        .get_spatial();
    // log!(format!(
    //     "recalc relative, anchor is at {}, self at {}",
    //     anchor_spatial.position, absolute_position
    // ));
    return absolute_position.subtract(&anchor_spatial.position);
}

fn try_restore_relative_position(
    movement: &mut Movement,
    absolute_position: &Vec2f64,
    indexes: &GameStateIndexes,
) {
    let restored = recalculate_relative_position(movement, absolute_position, indexes);
    match movement {
        Movement::RadialMonotonous {
            relative_position, ..
        } => {
            *relative_position = Some(relative_position.unwrap_or(restored));
        }
        _ => {}
    }
}

pub fn get_orbit_phase_table<'a, 'b>(
    rel_orbit_cache: &'a mut HashMap<u64, Vec<Vec2f64>>,
    movement_def: &'b Movement,
    orbit_radius: f64,
) -> &'a mut Vec<Vec2f64> {
    rel_orbit_cache
        .entry(coerce_phase_table_cache_key(orbit_radius))
        .or_insert_with(|| gen_rel_position_orbit_phase_table(&movement_def, orbit_radius))
}

pub fn get_rotation_phase_table<'a, 'b>(
    rot_cache: &'a mut HashMap<u64, Vec<f64>>,
    rot_movement_def: &'b RotationMovement,
    radius: f64,
) -> &'a mut Vec<f64> {
    rot_cache
        .entry(coerce_phase_table_cache_key(radius))
        .or_insert_with(|| gen_rotation_phase_table(&rot_movement_def, radius))
}

pub fn coerce_phase_table_cache_key(radius_value: f64) -> u64 {
    (radius_value * REL_ORBIT_CACHE_KEY_PRECISION) as u64
}

// assume that the table is a set of sequential circle coordinates
fn calculate_phase(table: &Vec<Vec2f64>, pos: &Vec2f64) -> Option<usize> {
    // this can be further optimized by using binary search and not calculating every single distance
    // log!(format!("calculate phase, {}", pos));
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
pub const REALISTIC_RELATIVE_ROTATION_PRECISION_DIVIDER: f64 = 16000.0;

// build a list of coordinates of the linear (segment) approximation of the circle, where every point
// is a vertex of the resulting polygon, in an assumption that precision is enough (subdivided to enough amount of points)
// so lerp(A,B) =~ the real circle point with some precision, but at the same time as low as possible
fn gen_rel_position_orbit_phase_table(def: &Movement, radius_to_anchor: f64) -> Vec<Vec2f64> {
    // log!(format!("calculate call {def:?} {radius_to_anchor:?}"));
    match def {
        Movement::RadialMonotonous {
            full_period_ticks,
            clockwise,
            ..
        } => {
            let mut res = vec![];

            let chosen_amount = choose_radial_amount(radius_to_anchor, *full_period_ticks);
            // log!(format!("gen radial amount, rad={radius_to_anchor}, period={full_period_ticks}, chosen={chosen_amount}"));
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

fn choose_radial_amount(radius_to_anchor: f64, full_period_ticks: f64) -> usize {
    let ideal_amount = radius_to_anchor * IDEAL_RELATIVE_ROTATION_PRECISION_MULTIPLIER; // completely arbitrary for now, without targeting specific precision
    let amount_from_period = full_period_ticks; // every tick is a point. However, it's super-unlikely that I will ever have an update every tick, and even every cycle of 16ms is unnecessary
    let realistic_amount = amount_from_period / REALISTIC_RELATIVE_ROTATION_PRECISION_DIVIDER; // precision with 1ms is probably fine-grained enough, equivalent to every cycle of 16ms

    let mut chosen_amount: usize = {
        if realistic_amount < 0.5 * ideal_amount {
            // this is bad, and will lead to horrible visual artifacts likely, so will reuse the ideal * 0.5 instead
            (0.5 * ideal_amount) as usize
        } else {
            // if realistic is between 0.5 and 1.0 of ideal, this is probably fine
            realistic_amount as usize
        }
    };
    if chosen_amount % 2 > 0 {
        chosen_amount += 1; // make even
    }
    chosen_amount
}

fn gen_rotation_phase_table(def: &RotationMovement, radius: f64) -> Vec<f64> {
    // log!(format!("calculate call {def:?} {radius_to_anchor:?}"));
    match def {
        RotationMovement::Monotonous {
            full_period_ticks, ..
        } => {
            let mut res: Vec<f64> = vec![];
            let chosen_amount = choose_radial_amount(radius, full_period_ticks.abs());
            let angle_step_rad = PI * 2.0 / chosen_amount as f64;
            let sign = full_period_ticks.signum();
            for i in 0..chosen_amount {
                let angle = i as f64 * angle_step_rad * sign;
                res.push(angle);
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
