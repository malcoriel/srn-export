use crate::planet_movement::{IBody, IBodyV2};
use crate::world::{Movement, Planet, PlanetV2};
use crate::{planet_movement, world, Vec2f64};
use std::collections::HashMap;

const TRAJECTORY_STEP_MICRO: i64 = 250 * 1000;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;

// TODO for some weird reason, it works for anchor_tier=2 too, however I do not support it here!
pub fn build_trajectory_to_body(
    from: Vec2f64,
    to: &Box<dyn IBodyV2>,
    to_anchor: &Box<dyn IBodyV2>,
    for_movement: &Movement,
) -> Vec<Vec2f64> {
    let bodies: Vec<Box<dyn IBodyV2>> = vec![to.clone(), to_anchor.clone()];
    let mut anchors = planet_movement::build_anchors_from_bodies(bodies);
    let mut shifts = HashMap::new();
    let mut counter = 0;
    let mut current_target = PlanetV2::from(to.clone());
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift =
        TRAJECTORY_STEP_MICRO as f64 * for_movement.get_current_linear_move_speed_per_tick();
    loop {
        let current_target_pos = current_target.spatial.position.clone();
        let distance = current_target_pos.euclidean_distance(&current_from);
        let should_break =
            counter >= TRAJECTORY_MAX_ITER || distance < to.get_spatial().radius / 2.0 + TRAJECTORY_EPS;
        if should_break {
            break;
        }
        current_from = world::move_ship(&current_target_pos, &current_from, max_shift);
        current_target = PlanetV2::from(planet_movement::simulate_planet_movement(
            TRAJECTORY_STEP_MICRO,
            &mut anchors,
            &mut shifts,
            Box::new(current_target.clone()),
        ));
        result.push(current_from);
        counter += 1;
    }
    let planet_pos = current_target.spatial.position.clone();
    // remove artifacts from the tail
    let mut count = 2;
    result = result
        .into_iter()
        .take_while(|p| {
            let cond = p.euclidean_distance(&planet_pos) < to.get_spatial().radius;
            if cond {
                count -= 1;
                return count > 0;
            }
            return true;
        })
        .collect::<Vec<_>>();
    result
}

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
