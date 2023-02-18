use crate::indexing::{GameStateCaches, GameStateIndexes};
use crate::planet_movement::{
    project_body_relative_position, project_movement_relative_position, IBodyV2,
};
use crate::world::{Movement, PlanetV2, SpatialProps};
use crate::{planet_movement, world, Vec2f64};
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
        current_from = world::move_ship_towards(&target_pos, &current_from, max_shift);
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
        current_from = world::move_ship_towards(&new_absolute_position, &current_from, max_shift);
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

pub fn distance(u: &[f64]) -> f64 {
    return ((u[0] * u[0]) + (u[1] * u[1])).sqrt();
}

pub fn distance_cost_gradient(u: &[f64], grad: &mut [f64]) {}

pub fn build_trajectory(
    tr: TrajectoryRequest,
    mov: &Movement,
    spatial: &SpatialProps,
) -> Vec<TrajectoryItem> {
    match mov {
        Movement::ShipAccelerated {
            max_linear_speed,
            max_rotation_speed,
            linear_drag,
            acc_linear,
            max_turn_speed,
            acc_angular,
        } => match tr {
            TrajectoryRequest::StartAndStop { to } => {
                /*
                let's assume we are in 1 dimension (moving in a straight line),
                and the ship is already facing the target
                if we start from velocity 0
                then t1 is the moment at which we accelerate to max
                and t2 is the moment when we start decelerating
                and t3 is the moment when we reach the target
                and a is acceleration and deceleration

                  / ------ \    velocity from time graph
                 /          \
                /            \

                then t3 - t2 = t1 - t0
                and t0 = 0
                so t3 = t1 + t2
                then distance is S = a * (t1 * t1 + t1 * t2)
                u0 = t1
                u1 = t2
                then we try to minimize the difference between target point and the distance resulting form the formula
                */
                let s = to.euclidean_distance(&spatial.position);
                let a = *acc_linear;
                let cost = move |u: &[f64], c: &mut f64| -> Result<(), SolverError> {
                    *c = (a * (u[0] * u[0] + u[0] * u[1]) - s).abs();
                    Ok(())
                };
                let cost_gradient = move |u: &[f64], grad: &mut [f64]| -> Result<(), SolverError> {
                    let x = u[0];
                    let y = u[1];
                    let denom_x = (a * (x * x + x * y) - s).abs();
                    let nom_x = (2.0 * x + y) * (a * (x * x + x * y) - s) * a;
                    grad[0] = nom_x / denom_x;
                    let denom_y = denom_x;
                    let nom_y = a * x * (a * (x * x + x * y) - s);
                    grad[1] = nom_y / denom_y;
                    Ok(())
                };
                let problem = Problem::new(&constraints::NoConstraints {}, cost_gradient, cost);
                let mut panoc_cache = PANOCCache::new(2, 1e-14, 10);
                let mut panoc = PANOCOptimizer::new(problem, &mut panoc_cache).with_max_iter(80);

                let mut u = [1.0, 2.0];
                // Invoke the solver
                let status = panoc.solve(&mut u);
                log!(format!("status {:?}", status));
                return vec![];
            }
            TrajectoryRequest::Impact { .. } => {
                return vec![];
            }
        },
        _ => panic!("cannot build trajectory for such movement"),
    }
}
