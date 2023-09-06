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
    from: &SpatialProps,
    to: &Vec2f64,
    for_movement: &Movement,
    update_every_ticks: u64,
) -> Vec<Vec2f64> {
    let mut counter = 0;
    let current_target = to.clone();
    let mut current_from = from.position.clone();
    let mut result = vec![];
    match for_movement {
        Movement::None => panic!("cannot build trajectory for no movement"),
        Movement::ShipMonotonous { .. } => {
            let max_shift = TRAJECTORY_STEP_ITERS as f64
                * update_every_ticks as f64
                * for_movement.get_max_speed();
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
                current_from =
                    spatial_movement::move_ship_towards(&target_pos, &current_from, max_shift);
                result.push(current_from);
                counter += 1;
            }
            result
        }
        _ => panic!("unsupported movement type for trajectory building"),
    }
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
    StartAndStopPoint { to: Vec2f64 },
    ImpactPoint { to: Vec2f64 },
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
#[serde(tag = "tag", content = "fields")]
pub enum TrajectoryResult {
    Success(Trajectory),
    Inaccessible,
    Unsupported,
    AlreadyClose,
}

impl TrajectoryResult {
    pub fn get_next(&mut self, current_spatial: &SpatialProps) -> Option<&TrajectoryItem> {
        // TODO prune the trajectory and if state is close enough to the current, get to the next one
        match self {
            TrajectoryResult::Success(tr) => tr.points.get(0),
            TrajectoryResult::Inaccessible => None,
            TrajectoryResult::Unsupported => None,
            TrajectoryResult::AlreadyClose => None,
        }
    }
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

// dumb solution that ignores acceleration and speed
pub fn build_naive_trajectory(from: Vec2f64, to: Vec2f64, intervals: usize) -> Vec<Vec2f64> {
    let diff = to.subtract(&from);
    let dir = diff.normalize();
    if let Some(dir) = dir {
        let mut result = vec![];
        let step = diff.euclidean_len() / intervals as f64;
        // point count = interval (step) count + 1, e.g.  O -> O -> O = 2 intervals but 3 points
        for i in 0..(intervals) {
            result.push(from.add(&dir.scalar_mul((i as f64 + 1.0) * step)))
        }
        result
    } else {
        vec![]
    }
}

pub fn build_trajectory_accelerated(
    tr: TrajectoryRequest,
    mov: &Movement,
    spatial: &SpatialProps,
) -> TrajectoryResult {
    match mov {
        Movement::ShipAccelerated { .. } => match tr {
            TrajectoryRequest::StartAndStopPoint { to } => {
                let naive =
                    build_naive_trajectory(spatial.position, to, TRAJECTORY_MAX_ITER as usize);
                return TrajectoryResult::Success(Trajectory {
                    points: naive
                        .into_iter()
                        .enumerate()
                        .map(|(i, p)| TrajectoryItem {
                            ticks: 0,
                            spatial: SpatialProps {
                                position: p,
                                velocity: spatial.velocity,
                                angular_velocity: spatial.angular_velocity,
                                rotation_rad: spatial.rotation_rad,
                                radius: spatial.radius,
                            },
                        })
                        .collect(),
                    total_ticks: 0,
                });
            }
            TrajectoryRequest::ImpactPoint { .. } => {
                return TrajectoryResult::Inaccessible;
            }
        },
        _ => panic!("cannot build trajectory for such movement"),
    }
}
