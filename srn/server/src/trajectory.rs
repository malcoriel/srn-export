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
use std::collections::{HashMap, VecDeque};
use std::f64::consts::PI;
use std::mem;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::wasm_bindgen;

const OLD_TRAJECTORY_STEP_ITERS: i64 = 20;
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
            let max_shift = OLD_TRAJECTORY_STEP_ITERS as f64
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
    let step_ticks = OLD_TRAJECTORY_STEP_ITERS as f64 * update_every_ticks as f64;
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

pub fn spatial_distance(a: &SpatialProps, b: &SpatialProps, precision_multiplier: f64) -> f64 {
    // The main 'smart' part of the trajectory is this heuristic metric,
    // which defines the full closeness - not only position, but also velocity and rotation.
    // The main goal of any guidance is to minimize this function
    let space_diff = a.position.euclidean_distance(&b.position);
    // normalize rotation angles to have correct distance
    let ar = if a.rotation_rad > PI {
        a.rotation_rad - 2.0 * PI
    } else {
        a.rotation_rad
    };
    let br = if b.rotation_rad > PI {
        b.rotation_rad - 2.0 * PI
    } else {
        b.rotation_rad
    };
    let rotation_diff = (ar - br).abs();
    let velocity_diff = a.velocity.subtract(&b.velocity).euclidean_len();
    let base_dist = 5.0 * rotation_diff + 20e4 * velocity_diff + space_diff;
    return base_dist * precision_multiplier;
}

pub const TRAJECTORY_PROXIMITY_POINT_ELIMINATE_DISTANCE: f64 = 4.0;

// we want to have roughly ~50% of the points of interpolation as the sliding window of target movement
pub const TRAJECTORY_PREFETCH_POINTS: usize = (INTERPOLATE_TRAJECTORY_COUNT as f64 * 0.5) as usize;
pub const FINAL_POINT_PRECISION_MULTIPLIER: f64 = 5.0;
pub const TRAJECTORY_INVALIDATE_RAW_DISTANCE: f64 = 10.0; // raw in the sense it's not the typical spatial metric, but literal distance
impl TrajectoryResult {
    pub fn get_next(
        &mut self,
        current_spatial: &SpatialProps,
        prefetch_next: usize,
    ) -> Option<(&TrajectoryItem, Vec<&TrajectoryItem>)> {
        // 0 - none, 1 - first, 2 - second, 3 - first and kill first
        let target_result = match self {
            TrajectoryResult::Success(tr) => {
                let first = tr.points.get(0);
                let second = tr.points.get(1);
                if first.is_none() {
                    // finish of the trajectory, no points left
                    0
                } else if second.is_none() {
                    let first_dist = first.map_or(99999.0, |first| {
                        spatial_distance(
                            &first.spatial,
                            current_spatial,
                            first.precision_multiplier,
                        )
                    });
                    let first_dist_raw = first.map_or(99999.0, |first| {
                        first
                            .spatial
                            .position
                            .euclidean_distance(&current_spatial.position)
                    });

                    if first_dist < TRAJECTORY_PROXIMITY_POINT_ELIMINATE_DISTANCE {
                        // only one remaining, and reached - trajectory is complete
                        3
                    } else if first_dist_raw > TRAJECTORY_INVALIDATE_RAW_DISTANCE {
                        0
                    } else {
                        // only one remaining, can't prune anyway
                        1
                    }
                } else {
                    let first = first.unwrap();
                    let second = second.unwrap();
                    let first_dist = spatial_distance(
                        &first.spatial,
                        current_spatial,
                        first.precision_multiplier,
                    );
                    let first_dist_raw = first
                        .spatial
                        .position
                        .euclidean_distance(&current_spatial.position);

                    let second_dist_raw = first
                        .spatial
                        .position
                        .euclidean_distance(&current_spatial.position);

                    if first_dist < TRAJECTORY_PROXIMITY_POINT_ELIMINATE_DISTANCE {
                        2
                    } else {
                        let second_dist = spatial_distance(
                            &second.spatial,
                            current_spatial,
                            second.precision_multiplier,
                        );

                        if first_dist_raw > TRAJECTORY_INVALIDATE_RAW_DISTANCE
                            && second_dist_raw > TRAJECTORY_INVALIDATE_RAW_DISTANCE
                        {
                            0
                        } else if second_dist < first_dist {
                            2
                        } else {
                            1
                        }
                    }
                }
            }
            TrajectoryResult::Inaccessible => 0,
            TrajectoryResult::Unsupported => 0,
            TrajectoryResult::AlreadyClose => 0,
        };
        return match self {
            TrajectoryResult::Success(tr) => {
                if target_result == 1 {
                    let next = Self::read_body(&tr.points, prefetch_next);
                    tr.points.get(0).map(|v| (v, next))
                } else if target_result == 2 {
                    tr.points.pop_front();
                    let next = Self::read_body(&tr.points, prefetch_next);
                    tr.points.get(0).map(|v| (v, next))
                } else if target_result == 3 {
                    tr.points.pop_front();
                    None
                } else {
                    None
                }
            }
            TrajectoryResult::Inaccessible => None,
            TrajectoryResult::Unsupported => None,
            TrajectoryResult::AlreadyClose => None,
        };
    }

    pub fn read_body(points: &VecDeque<TrajectoryItem>, n: usize) -> Vec<&TrajectoryItem> {
        // assuming that the head was already received, those are just extra next items to
        // make the trajectory guidance smooth
        let mut res = vec![];
        for i in 1..(n + 1) {
            if let Some(item) = points.get(i) {
                res.push(item);
            }
        }
        res
    }
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
pub struct TrajectoryItem {
    // in relation to '0' where 0 is the start of the request
    pub ticks: i32,
    pub is_reference_point: bool,
    pub precision_multiplier: f64,
    pub spatial: SpatialProps,
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
pub struct Trajectory {
    pub points: VecDeque<TrajectoryItem>,
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
    let eps = 1e-6;
    match mov {
        Movement::ShipAccelerated { .. } => {
            return match tr {
                TrajectoryRequest::StartAndStopPoint { to } => {
                    let too_close_dist = spatial_distance(
                        &spatial,
                        &SpatialProps {
                            position: to,
                            velocity: Vec2f64::zero(),
                            angular_velocity: 0.0,
                            rotation_rad: spatial.rotation_rad,
                            radius: 0.0,
                        },
                        0.5,
                    );
                    // sometimes I overdo the trajectory for some reason and build it again when unit is already close
                    if too_close_dist < TRAJECTORY_PROXIMITY_POINT_ELIMINATE_DISTANCE {
                        return TrajectoryResult::AlreadyClose;
                    }
                    // We will (wrongly, intentionally) assume that the request is always coming from
                    // "stabilized" point, meaning a point that has rotation pointing
                    // towards the goal, and speed direction pointing towards the goal.
                    // In reality, this will be the job of another TrajectoryRequest::Stabilize that we
                    // will try to chain together with this one in complex cases.
                    // Also, we will assume that velocity at end is always zero, regardless of actual request.
                    // In reality, we will probably need a separate TrajectoryRequest::Realign that
                    // will handle that job.

                    let mut points = vec![];

                    // the current point to have interpolation
                    points.push(TrajectoryItem {
                        ticks: 0,
                        is_reference_point: false,
                        precision_multiplier: 0.0, // will immediately eliminate it when used
                        spatial: spatial.clone(),
                    });

                    // first, we need to find 2 crucial point - max speed reach and start decelerate
                    // Stages of process are obviously for trapezoidal speed value - accelerate, maintain, decelerate
                    let curr_speed = spatial.velocity.euclidean_len();
                    let acc = mov.get_current_linear_acceleration();
                    let time_to_compensate = curr_speed / acc;
                    let brake_distance = time_to_compensate * time_to_compensate * acc;
                    let time_to_compensate_max = mov.get_max_speed() / acc;
                    let brake_distance_max = time_to_compensate_max * time_to_compensate_max * acc;

                    let dist_to_target = spatial.position.euclidean_distance(&to);
                    if dist_to_target < brake_distance {
                        // this means trajectory will go over the target point, turn back and return
                        // log2!("overshoot");
                        let overshoot_dist = brake_distance - dist_to_target;
                        let dir_norm = if let Some(dir_to_target) =
                            to.subtract(&spatial.position).normalize()
                        {
                            dir_to_target
                        } else {
                            if let Some(vel_norm) = spatial.velocity.normalize() {
                                vel_norm
                            } else {
                                Vec2f64::zero()
                            }
                        };
                        let turn_around_point =
                            spatial.position.add(&dir_norm.scalar_mul(overshoot_dist));
                        points.push(TrajectoryItem {
                            ticks: 0,
                            is_reference_point: true,
                            precision_multiplier: 2.0,
                            spatial: SpatialProps {
                                position: turn_around_point,
                                velocity: spatial.velocity.scalar_mul(-1.0),
                                angular_velocity: 0.0,
                                rotation_rad: 0.0,
                                radius: 0.0,
                            },
                        });
                        points.push(TrajectoryItem {
                            ticks: 0,
                            is_reference_point: true,
                            precision_multiplier: FINAL_POINT_PRECISION_MULTIPLIER,
                            spatial: SpatialProps {
                                position: to,
                                velocity: Vec2f64::zero(),
                                angular_velocity: 0.0,
                                rotation_rad: 0.0,
                                radius: 0.0,
                            },
                        })
                    } else {
                        // solvable situation
                        if (curr_speed - mov.get_max_speed()).abs() < eps {
                            // log2!("maintain");

                            // we are in maintain, so we need to fly till decelerate point
                            let dir_to_target = to.subtract(&spatial.position).normalize().expect("max speed but zero direction and not after brake point, how can it be?");
                            let decelerate_point =
                                to.subtract(&dir_to_target.scalar_mul(time_to_compensate_max));

                            // decelerate point
                            points.push(TrajectoryItem {
                                ticks: 0,
                                is_reference_point: true,
                                precision_multiplier: 1.0,
                                spatial: SpatialProps {
                                    position: decelerate_point,
                                    velocity: dir_to_target.scalar_mul(mov.get_max_speed()),
                                    angular_velocity: 0.0,
                                    rotation_rad: 0.0,
                                    radius: 0.0,
                                },
                            });
                            // end point
                            points.push(TrajectoryItem {
                                ticks: 0,
                                is_reference_point: true,
                                precision_multiplier: FINAL_POINT_PRECISION_MULTIPLIER,
                                spatial: SpatialProps {
                                    position: to,
                                    velocity: Vec2f64::zero(),
                                    angular_velocity: 0.0,
                                    rotation_rad: 0.0,
                                    radius: 0.0,
                                },
                            })
                        } else {
                            if dist_to_target < brake_distance_max {
                                // we can't use the max speed acceleration, but we probably can accelerate
                                // a bit - depending on the current speed and distance to target

                                let current_speed = spatial.velocity.euclidean_len();
                                if let Some(time_to_peak) = solve_peak_speed(
                                    dist_to_target,
                                    current_speed,
                                    acc,
                                    mov.get_max_speed(),
                                ) {
                                    let max_achievable_speed = current_speed + acc * time_to_peak;
                                    let extra_distance_till_peak = current_speed * time_to_peak
                                        + acc * time_to_peak * time_to_peak;
                                    let dir_to_target = to.subtract(&spatial.position).normalize().expect("max speed but zero direction and not after brake point, how can it be?");
                                    // log2!("peak");
                                    // peak point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: 1.0,
                                        spatial: SpatialProps {
                                            position: spatial.position.add(
                                                &dir_to_target.scalar_mul(extra_distance_till_peak),
                                            ),
                                            velocity: dir_to_target
                                                .scalar_mul(max_achievable_speed),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    });
                                    // end point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: FINAL_POINT_PRECISION_MULTIPLIER,
                                        spatial: SpatialProps {
                                            position: to,
                                            velocity: Vec2f64::zero(),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    })
                                } else {
                                    // hitting this requires some kind of insane precision, so it might be an impossible
                                    // branch
                                    // log2!("dec");
                                    // we are in decelerate, so only need to decelerate further
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: FINAL_POINT_PRECISION_MULTIPLIER,
                                        spatial: SpatialProps {
                                            position: to,
                                            velocity: Vec2f64::zero(),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    })
                                }
                            } else {
                                let current_speed = spatial.velocity.euclidean_len();
                                if let Some(time_to_peak) = solve_peak_speed(
                                    dist_to_target,
                                    current_speed,
                                    acc,
                                    mov.get_max_speed(),
                                ) {
                                    let max_achievable_speed = current_speed + acc * time_to_peak;
                                    let extra_distance_till_peak = current_speed * time_to_peak
                                        + acc * time_to_peak * time_to_peak;
                                    let dir_to_target = to.subtract(&spatial.position).normalize().expect("max speed but zero direction and not after brake point, how can it be?");
                                    // log2!("peak 2");
                                    // peak point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: 1.0,
                                        spatial: SpatialProps {
                                            position: spatial.position.add(
                                                &dir_to_target.scalar_mul(extra_distance_till_peak),
                                            ),
                                            velocity: dir_to_target
                                                .scalar_mul(max_achievable_speed),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    });
                                    // end point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: FINAL_POINT_PRECISION_MULTIPLIER,
                                        spatial: SpatialProps {
                                            position: to,
                                            velocity: Vec2f64::zero(),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    })
                                } else {
                                    // log2!("full");
                                    // we are in accelerate, so need all 3 stages
                                    let dir_to_target = to.subtract(&spatial.position).normalize().expect("max speed but zero direction and not after brake point, how can it be?");
                                    let decelerate_point =
                                        to.subtract(&dir_to_target.scalar_mul(
                                            time_to_compensate_max * mov.get_max_speed(),
                                        ));
                                    let maintain_point =
                                        spatial.position.add(&dir_to_target.scalar_mul(
                                            time_to_compensate_max * mov.get_max_speed(),
                                        )); // time_to_compensate = time_to_accelerate

                                    // maintain point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: 1.0,
                                        spatial: SpatialProps {
                                            position: maintain_point,
                                            velocity: dir_to_target.scalar_mul(mov.get_max_speed()),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    });
                                    // decelerate point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: 1.0,
                                        spatial: SpatialProps {
                                            position: decelerate_point,
                                            velocity: dir_to_target.scalar_mul(mov.get_max_speed()),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    });
                                    // end point
                                    points.push(TrajectoryItem {
                                        ticks: 0,
                                        is_reference_point: true,
                                        precision_multiplier: FINAL_POINT_PRECISION_MULTIPLIER,
                                        spatial: SpatialProps {
                                            position: to,
                                            velocity: Vec2f64::zero(),
                                            angular_velocity: 0.0,
                                            rotation_rad: 0.0,
                                            radius: 0.0,
                                        },
                                    });
                                    // log2!("{:?}", points);
                                }
                            }
                        }
                    }

                    interpolate_and_estimate_trajectory_points(&mut points);

                    TrajectoryResult::Success(Trajectory {
                        points: VecDeque::from(points),
                        total_ticks: 0,
                    })
                }
                TrajectoryRequest::ImpactPoint { .. } => TrajectoryResult::Inaccessible,
            };
        }
        _ => panic!("cannot build trajectory for such movement"),
    }
}

pub const INTERPOLATE_TRAJECTORY_COUNT: usize = 16;
pub fn interpolate_and_estimate_trajectory_points(points: &mut Vec<TrajectoryItem>) {
    let mut extras: Vec<Vec<TrajectoryItem>> = vec![];
    let points_len = points.len();
    for i in 0..points_len - 1 {
        let curr = &points[i];
        let next = &points[i + 1];
        let dist = next.spatial.position.subtract(&curr.spatial.position);
        let dir = dist.normalize().unwrap_or(Vec2f64::zero());
        let dist_len = dist.euclidean_len();
        let mut steps_count = INTERPOLATE_TRAJECTORY_COUNT as f64;
        let mut step_len = dist_len / (steps_count + 1.0);
        // if this is not done, concept of next may eliminate next points in normal flow, leading to constants invalidation of trajectory
        while step_len > TRAJECTORY_INVALIDATE_RAW_DISTANCE / 2.0 {
            steps_count += 1.0;
            step_len = dist_len / (steps_count + 1.0);
        }
        let step = dir.scalar_mul(step_len);
        let mut interpolated = vec![];
        let desired_rotation = dir.angle_rad_circular_rotation(&Vec2f64::new(1.0, 0.0));
        for j in 0..(steps_count as usize) {
            interpolated.push(TrajectoryItem {
                ticks: 0,
                is_reference_point: false,
                precision_multiplier: 1.0,
                spatial: SpatialProps {
                    position: curr.spatial.position.add(&step.scalar_mul(j as f64 + 1.0)),
                    velocity: curr
                        .spatial
                        .velocity
                        .lerp_to(&next.spatial.velocity, j as f64 / steps_count),
                    angular_velocity: 0.0,
                    rotation_rad: desired_rotation,
                    radius: 0.0,
                },
            });
        }
        points[i + 1].spatial.rotation_rad = desired_rotation;
        extras.push(interpolated);
    }
    let mut tmp: Vec<TrajectoryItem> = vec![];
    let mut orig_counter = 0;
    // the amount of elements matches the amount of gaps between the points of original trajectory, which is n-1
    for mut extra_points in extras {
        tmp.push(points[orig_counter].clone());
        orig_counter += 1;
        tmp.append(&mut extra_points)
    }
    tmp.push(points[orig_counter].clone()); // ensure last point is there
    mem::swap(points, &mut tmp);
}

// S_f - distance to target
// V_0 - current speed
// a - acceleration, assuming same for acc and decc
// max_v - speed cap that may invalidate the solution
// the answer is time required to get to the peak speed until we need to decelerate to stop at the target
fn solve_peak_speed(s_f: f64, v_0: f64, a: f64, max_v: f64) -> Option<f64> {
    if s_f < 0.0 {
        warn2!("Distance cannot be negative");
        return None;
    }
    if v_0 < 0.0 {
        warn2!("Speed cannot be negative");
        return None;
    }
    if a < 0.0 {
        warn2!("Acceleration cannot be negative");
        return None;
    }
    // if we had no speed in the beginning, then S/2 = a * t_h * t_h, where t_h is time necessary to get to peak of the speed
    // also, t_h = t_0 + t_a, where t_0 is the time required to get to the current v_0, and t_a is difference between that and t_h
    // also, S = S_f + S_0, where S_0 is distance passed to get to the speed V_0 from 0 speed
    // also, t_0 = V_0 / a by definition
    // then, (S_f + S_0) / 2 = a * t_h * t_h
    // then t_h = sqrt((S_f + S_0) / (2*a))
    // then, t_a that we seek is...
    let t_h = ((s_f + (v_0 * v_0) / a) / 2.0 / a).sqrt();
    let t_0 = v_0 / a;
    let t_a = t_h - t_0;
    return if t_a > 0.0 {
        let reached_speed = v_0 + a * t_a;
        if reached_speed > max_v {
            None
        } else {
            Some(t_a)
        }
    } else {
        warn2!("Negative arrive to peak time");
        None
    };
}
