use crate::planet_movement::{IBodyV2};
use crate::world::{Movement, PlanetV2};
use crate::{planet_movement, world, Vec2f64};
use std::collections::HashMap;

const TRAJECTORY_STEP_MICRO: i64 = 250 * 1000;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;

pub fn build_trajectory_to_point(
    from: Vec2f64,
    to: &Vec2f64,
    for_movement: &Movement,
) -> Vec<Vec2f64> {
    let mut counter = 0;
    let current_target = to.clone();
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift =
        TRAJECTORY_STEP_MICRO as f64 * for_movement.get_current_linear_move_speed_per_tick();
    loop {
        let target_pos = Vec2f64 {
            x: current_target.x,
            y: current_target.y,
        };
        let distance = target_pos.euclidean_distance(&current_from);
        let should_break = counter >= TRAJECTORY_MAX_ITER || distance < max_shift;
        if should_break {
            break;
        }
        current_from = world::move_ship(&target_pos, &current_from, max_shift);
        result.push(current_from);
        counter += 1;
    }
    result
}
