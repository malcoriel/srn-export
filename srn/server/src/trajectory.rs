use crate::indexing::{GameStateCaches, GameStateIndexes};
use crate::planet_movement::{
    project_body_relative_position, project_movement_relative_position, IBodyV2,
};
use crate::spatial_movement::Movement;
use crate::world::{PlanetV2, SpatialProps};
use crate::{planet_movement, spatial_movement, world, Vec2f64};
use optimization_engine::panoc::{PANOCCache, PANOCOptimizer};
use optimization_engine::{constraints, Optimizer, Problem, SolverError};
use serde_derive::Deserialize;
use serde_derive::Serialize;
use std::borrow::BorrowMut;
use std::collections::HashMap;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::wasm_bindgen;

const TRAJECTORY_STEP_ITERS: i64 = 20;
const TRAJECTORY_MAX_ITER: i32 = 10;
const TRAJECTORY_EPS: f64 = 0.1;

pub fn build_trajectory_to_point(
    from: Vec2f64,
    to: &Vec2f64,
    for_movement: &Movement,
    update_every_ticks: u64,
) -> Vec<Vec2f64> {
    let mut counter = 0;
    let current_target = to.clone();
    let mut current_from = from.clone();
    let mut result = vec![];
    let max_shift =
        TRAJECTORY_STEP_ITERS as f64 * update_every_ticks as f64 * for_movement.get_max_speed();
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
        current_from = spatial_movement::move_ship_towards(&target_pos, &current_from, max_shift);
        result.push(current_from);
        counter += 1;
    }
    result
}

pub fn build_trajectory_to_planet(
    current_pos: Vec2f64,
    planet: &Box<&dyn IBodyV2>,
    anchor: &Box<&dyn IBodyV2>,
    ship_movement: &Movement,
    update_every_ticks: u64,
    initial_ticks: u64,
    indexes: &GameStateIndexes,
    caches: &mut GameStateCaches,
) -> Vec<Vec2f64> {
    let mut counter = 0;
    let mut current_from = current_pos;
    let mut result = vec![];
    let step_ticks = TRAJECTORY_STEP_ITERS as f64 * update_every_ticks as f64;
    let max_shift = step_ticks * ship_movement.get_max_speed();
    let mut current_ticks = initial_ticks;
    let planet_radius = planet.get_spatial().radius;
    let anchor_dist = planet.get_anchor_dist(indexes);
    loop {
        current_ticks += step_ticks as u64;
        let mut mutable_planet_mov = planet.get_movement().clone();
        project_movement_relative_position(
            current_ticks,
            caches,
            anchor_dist,
            &mut mutable_planet_mov,
            planet.spec(),
        );
        let new_absolute_position = anchor
            .get_spatial()
            .position
            .add(&mutable_planet_mov.get_anchor_relative_position().expect("cannot calculate trajectory to a planet without relative position, make sure it's restored first"));
        let distance = new_absolute_position.euclidean_distance(&current_from);
        let should_break = counter >= TRAJECTORY_MAX_ITER || distance <= planet_radius;
        if should_break {
            break;
        }
        current_from =
            spatial_movement::move_ship_towards(&new_absolute_position, &current_from, max_shift);
        result.push(current_from);
        counter += 1;
    }
    result
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
#[serde(tag = "tag")]
pub enum TrajectoryRequest {
    StartAndStop { to: Vec2f64 },
    Impact { to: Vec2f64 },
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
pub struct TrajectoryItem {
    // in relation to '0' where 0 is the start of the request
    pub ticks: i32,
    pub spatial: SpatialProps,
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
pub struct Trajectory {
    pub points: Vec<TrajectoryItem>,
    pub total_ticks: i32,
}

pub fn acc_time_for_dist(_acc: f64, _dist: f64, _vmax: f64) -> f64 {
    // TODO: this is for a real physical movement without vmax, but I have to cap it somehow
    // return (Math.abs(dist / acc)).sqrt();
    return 0.0;
}

pub fn build_trajectory(
    tr: TrajectoryRequest,
    mov: &Movement,
    spatial: &SpatialProps,
) -> Trajectory {
    match mov {
        Movement::ShipAccelerated { .. } => match tr {
            TrajectoryRequest::StartAndStop { to } => {
                if spatial.velocity.euclidean_len() != 0.0 {
                    panic!("need to stabilize");
                }

                let points = vec![TrajectoryItem {
                    ticks: 0,
                    spatial: spatial.clone(),
                }];

                let dir = to.subtract(&spatial.position).normalize();
                if dir.is_none() {
                    // already there
                    return Trajectory {
                        points,
                        total_ticks: 0,
                    };
                }
                let dir = dir.unwrap();
                let angle_dir = Vec2f64 { x: 1.0, y: 0.0 }.angle_rad(&dir);
                let diff = angle_dir - spatial.rotation_rad;
                let _time = acc_time_for_dist(diff, 0.0, 0.0);

                // turn first
                // TODO

                return Trajectory {
                    points: points,
                    total_ticks: 0,
                };
            }
            TrajectoryRequest::Impact { .. } => {
                return Trajectory {
                    points: vec![],
                    total_ticks: 0,
                }
            }
        },
        _ => panic!("cannot build trajectory for such movement"),
    }
}
