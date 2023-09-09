use crate::combat::{guide_accelerated_object, markers_to_string};
use crate::indexing::{
    find_planet, index_planets_by_id, GameStateCaches, GameStateIndexes, IdKind, ObjectSpecifier,
};
use crate::long_actions::{
    try_start_long_action_ship_only, LongAction, LongActionStart, MIN_SHIP_DOCKING_RADIUS,
    SHIP_DOCKING_RADIUS_COEFF,
};
use crate::planet_movement::IBodyV2;
use crate::trajectory::{
    build_trajectory_accelerated, TrajectoryItem, TrajectoryRequest, TrajectoryResult,
};
use crate::vec2::{deg_to_rad, Precision, Vec2f64};
use crate::world::{GameState, Location, PlanetV2, Ship, ShipIdx, SpatialProps, UpdateOptions};
use crate::world_actions::MoveAxisParam;
use crate::world_events::GameEvent;
use crate::{fire_event, trajectory, world, world_events};
use rand_pcg::Pcg64Mcg;
use serde_derive::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;
use std::iter::FromIterator;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

// keep synced with world.ts
const MANUAL_MOVEMENT_INACTIVITY_DROP_MS: i32 = 500;

pub fn update_ship_manual_movement(
    elapsed_micro: i64, // can be negative for the sake of applying StopGas in the past
    current_tick: u32,
    ship: &mut Ship,
    client: bool,
    skip_throttle_drop: bool, // special param for action-in-the-past lag compensation
) {
    let move_read = ship.movement_definition.clone();
    match move_read {
        Movement::None => {}
        Movement::ShipMonotonous { .. } => {
            if !maybe_drop_outdated_movement_marker(current_tick, ship, client, skip_throttle_drop)
            {
                let gas_marker = &ship.movement_markers.gas;
                let sign: f64 = gas_marker
                    .as_ref()
                    .map_or(0.0, |m| if m.forward { 1.0 } else { -1.0 });
                if sign != 0.0 {
                    let new_pos = project_ship_movement_by_speed(elapsed_micro, ship, sign);
                    ship.set_from(&new_pos);
                }
            }
            let (new_move, new_rotation) = if let Some(params) = &ship.movement_markers.turn {
                if (params.last_tick as i32 - current_tick as i32).abs()
                    > MANUAL_MOVEMENT_INACTIVITY_DROP_MS
                {
                    (None, None)
                } else {
                    let sign = if params.forward { 1.0 } else { -1.0 };
                    let diff =
                        ship.movement_definition.get_angular_speed() * elapsed_micro as f64 * sign;

                    (
                        Some(params.clone()),
                        Some((ship.spatial.rotation_rad + diff) % (2.0 * PI)),
                    )
                }
            } else {
                (None, None)
            };
            ship.movement_markers.turn = new_move;
            if let Some(new_rotation) = new_rotation {
                ship.spatial.rotation_rad = new_rotation % (2.0 * PI);
            }
        }
        Movement::ShipAccelerated { .. } => {
            maybe_drop_outdated_movement_markers(current_tick, ship, client, skip_throttle_drop);
            let gas_sign: f64 =
                ship.movement_markers
                    .gas
                    .as_ref()
                    .map_or(0.0, |m| if m.forward { 1.0 } else { -1.0 });
            let turn_sign: f64 =
                ship.movement_markers
                    .turn
                    .as_ref()
                    .map_or(0.0, |m| if m.forward { 1.0 } else { -1.0 });
            let brake_sign: f64 =
                ship.movement_markers
                    .brake
                    .as_ref()
                    .map_or(0.0, |m| if m.forward { 1.0 } else { 0.0 });
            update_accelerated_movement(
                elapsed_micro,
                &mut ship.spatial,
                &mut ship.movement_definition,
                gas_sign,
                turn_sign,
                brake_sign,
                1.0,
            );
        }
        Movement::RadialMonotonous { .. } => {}
        Movement::AnchoredStatic { .. } => {}
    }
}

fn maybe_drop_outdated_movement_marker(
    current_tick: u32,
    ship: &mut Ship,
    client: bool,
    skip_throttle_drop: bool,
) -> bool {
    // returns true if dropped
    let new_move = if let Some(params) = &mut ship.movement_markers.gas {
        if should_throttle_drop_manual_movement_marker(
            current_tick,
            client,
            skip_throttle_drop,
            params,
        ) {
            None
        } else {
            Some(params.clone())
        }
    } else {
        None
    };
    return if let Some(new_move) = new_move {
        ship.movement_markers.gas = Some(new_move);
        false
    } else {
        true
    };
}

fn maybe_drop_outdated_movement_markers(
    current_tick: u32,
    ship: &mut Ship,
    client: bool,
    skip_throttle_drop: bool,
) {
    if let Some(params) = &mut ship.movement_markers.gas {
        if should_throttle_drop_manual_movement_marker(
            current_tick,
            client,
            skip_throttle_drop,
            params,
        ) {
            ship.movement_markers.gas = None;
        }
    }
    if let Some(params) = &mut ship.movement_markers.turn {
        if should_throttle_drop_manual_movement_marker(
            current_tick,
            client,
            skip_throttle_drop,
            params,
        ) {
            ship.movement_markers.turn = None;
        }
    }
    if let Some(params) = &mut ship.movement_markers.brake {
        if should_throttle_drop_manual_movement_marker(
            current_tick,
            client,
            skip_throttle_drop,
            params,
        ) {
            ship.movement_markers.brake = None;
        }
    }
}

fn should_throttle_drop_manual_movement_marker(
    current_tick: u32,
    client: bool,
    skip_throttle_drop: bool,
    params: &mut MoveAxisParam,
) -> bool {
    (params.last_tick as i32 - current_tick as i32).abs()
        > MANUAL_MOVEMENT_INACTIVITY_DROP_MS
        && !client
        // assume that on client, we always hold the button - this one is only a server optimization
        && !skip_throttle_drop
}

fn project_ship_movement_by_speed(elapsed_micro: i64, ship: &Ship, sign: f64) -> Vec2f64 {
    let distance = ship.movement_definition.get_max_speed() * elapsed_micro as f64 * sign;
    let shift = Vec2f64 { x: 1.0, y: 0.0 }
        .rotate(-ship.spatial.rotation_rad)
        .scalar_mul(distance);
    let new_pos = ship.spatial.position.add(&shift);
    new_pos
}

// somewhat an artificial drag to prevent infinite movement. It is a = m/s^2
pub const SPACE_DRAG_PER_TICK_PER_TICK: f64 = 1.0 / 1e6 / 1e6;

// really low infinite rotation prevention drag. it's more or less fine to keep objects rotating
pub const TURN_DRAG_RAD_PER_TICK: f64 = PI / 100.0 / 1e6 / 1e6;
pub const GAS_TURN_STABILIZATION_ANGULAR_DRAG_FACTOR: f64 = 2000.0;

// to counteract the low rotation drag above for anything that is controlled,
// specifically ships and rockets - let's imagine that
// every engine has a special stabilizer that increases drag (while still negating it when turning)
pub const SHIP_TURN_STABILIZATION_ANGULAR_DRAG_FACTOR: f64 = 30.0;

fn update_spatial_by_velocities(
    elapsed_micro: i64,
    spatial: &mut SpatialProps,
    _debug: bool,
    rotation_drag_multiplier: f64,
    negate_angular_drag: bool,
    negate_linear_drag: bool,
) {
    let linear_drag = if negate_linear_drag {
        Vec2f64::zero()
    } else {
        spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(SPACE_DRAG_PER_TICK_PER_TICK * elapsed_micro as f64)
    };
    if spatial.velocity.euclidean_len() > linear_drag.euclidean_len() {
        spatial.velocity = spatial.velocity.subtract(&linear_drag);
    } else {
        spatial.velocity = Vec2f64::zero();
    }
    if spatial.velocity.euclidean_len() <= MIN_OBJECT_SPEED_PER_TICK {
        spatial.velocity = Vec2f64::zero();
    }
    let shift = &spatial.velocity.scalar_mul(elapsed_micro as f64);
    spatial.position = spatial.position.add(&shift);

    let angular_drag = if negate_angular_drag {
        0.0
    } else {
        spatial.angular_velocity.signum()
            * TURN_DRAG_RAD_PER_TICK
            * rotation_drag_multiplier
            * elapsed_micro as f64
    };
    if spatial.angular_velocity.abs() > angular_drag.abs() {
        spatial.angular_velocity -= angular_drag;
    } else {
        spatial.angular_velocity = 0.0;
    }
    if spatial.angular_velocity.abs() <= MIN_OBJECT_TURN_SPEED_RAD_PER_TICK {
        spatial.angular_velocity = 0.0;
    }
    spatial.rotation_rad += spatial.angular_velocity * elapsed_micro as f64;
    spatial.rotation_rad = spatial.rotation_rad % (2.0 * PI);
}

pub const MIN_TURN_VALUE: f64 = 1e-6;
pub fn update_accelerated_movement(
    elapsed_micro: i64,
    spatial: &mut SpatialProps,
    movement_definition: &Movement,
    gas_sign: f64,
    turn_val: f64, // for the sake of projectile movement, it turned out to be necessary to allow fractional value
    brake_sign: f64,
    rotation_drag_multiplier: f64,
) {
    if brake_sign != 0.0 {
        let linear_brake = spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(movement_definition.get_brake_acc() * elapsed_micro as f64);
        spatial.velocity = spatial.velocity.subtract(&linear_brake);
    }

    let thrust_dir = Vec2f64 { x: 1.0, y: 0.0 }.rotate(-spatial.rotation_rad);
    let space_acceleration = thrust_dir.scalar_mul(
        movement_definition.get_current_linear_acceleration() * elapsed_micro as f64 * gas_sign,
    );
    spatial.velocity = spatial.velocity.add(&space_acceleration);
    let max_speed = movement_definition.get_max_speed();
    if spatial.velocity.euclidean_len() > max_speed {
        spatial.velocity = spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(max_speed);
    }

    if turn_val.abs() > MIN_TURN_VALUE {
        spatial.angular_velocity += turn_val
            * movement_definition.get_current_angular_acceleration()
            * elapsed_micro as f64;
    }

    let max_rotation_speed = movement_definition.get_max_rotation_speed();

    if spatial.angular_velocity.abs() > max_rotation_speed {
        spatial.angular_velocity = spatial.angular_velocity.signum() * max_rotation_speed;
    }

    let negate_angular_drag = turn_val.abs() > MIN_TURN_VALUE;
    let gassing = gas_sign != 0.0;
    update_spatial_by_velocities(
        elapsed_micro,
        spatial,
        false,
        SHIP_TURN_STABILIZATION_ANGULAR_DRAG_FACTOR
            * if gassing {
                rotation_drag_multiplier * GAS_TURN_STABILIZATION_ANGULAR_DRAG_FACTOR
            } else {
                rotation_drag_multiplier
            },
        negate_angular_drag,
        gassing,
    );
}

pub const EXTRA_PROJECTILE_TURN_DRAG: f64 = 10.0;

pub const ORB_SPEED_MULT: f64 = 1.0;

pub fn update_objects_spatial_movement(
    location: &mut Location,
    elapsed_micro: i64,
    current_tick: u32,
    client: bool,
) {
    // ships follow fairly special rules, although similar to normal object
    for ship in location.ships.iter_mut() {
        update_ship_manual_movement(elapsed_micro, current_tick, ship, client, false);
    }
    // every other object that cannot change its speed itself, will drift - basically, unguided physics
    for wreck in location.wrecks.iter_mut() {
        update_spatial_by_velocities(elapsed_micro, &mut wreck.spatial, false, 1.0, false, false);
    }
    for asteroid in location.asteroids.iter_mut() {
        update_spatial_by_velocities(
            elapsed_micro,
            &mut asteroid.spatial,
            false,
            1.0,
            false,
            false,
        );
    }
}

pub fn align_rotation_with_velocity(sp: &mut SpatialProps) {
    let base = Vec2f64 { x: 1.0, y: 0.0 };
    let velocity_angle = sp.velocity.angle_rad(&base);
    sp.rotation_rad = velocity_angle;
}

pub fn dock_ship(
    state: &mut GameState,
    ship_idx: ShipIdx,
    player_idx: Option<usize>,
    body: Box<dyn IBodyV2>,
) {
    let ship_clone = {
        let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
        ship.docked_at = Some(body.get_id());
        ship.dock_target = None;
        ship.spatial.position = body.get_spatial().position.clone();
        ship.trajectory = vec![];
        ship.clone()
    };
    let player_id = player_idx.map(|idx| state.players[idx].id);
    let player_name = player_idx.map(|idx| state.players[idx].name.clone());
    let planet_name = body.get_name().clone();
    world_events::fire_saved_event(
        state,
        GameEvent::ShipDocked {
            ship: ship_clone,
            planet: PlanetV2::from(body),
            player_id,
            state_id: state.id,
            text_representation: if let Some(player_name) = player_name {
                format!("Player {} docked at {}", player_name, planet_name)
            } else {
                "".to_string()
            },
        },
    );
}

pub fn undock_ship(
    state: &mut GameState,
    ship_idx: ShipIdx,
    client: bool,
    player_idx: Option<usize>,
    prng: &mut Pcg64Mcg,
) {
    let state_read = state.clone();
    let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    if let Some(planet_id) = ship.docked_at {
        ship.docked_at = None;
        if let Some(planet) = find_planet(&state_read, &planet_id) {
            let planet = planet.clone();
            ship.spatial.position = planet.spatial.position.clone();
            if !client {
                fire_event(GameEvent::ShipUndocked {
                    state_id: state.id,
                    ship: ship.clone(),
                    planet,
                    player_id: player_idx.map(|player_idx| state.players[player_idx].id),
                });
                try_start_long_action_ship_only(
                    state,
                    &ship_idx,
                    LongActionStart::UndockInternal {
                        from_planet: planet_id,
                    },
                    prng,
                );
            }
        }
    }
}

pub fn move_ship_towards(target: &Vec2f64, ship_pos: &Vec2f64, max_shift: f64) -> Vec2f64 {
    return if let Some(dir) = target.subtract(&ship_pos).normalize() {
        let shift = dir.scalar_mul(max_shift);
        let new_pos = ship_pos.add(&shift);
        new_pos
    } else {
        ship_pos.clone()
    };
}

pub fn update_ships_navigation(
    ships: &Vec<Ship>,
    elapsed: i64,
    _client: bool,
    update_options: &UpdateOptions,
    indexes: &GameStateIndexes,
    update_every_ticks: u64,
    caches: &mut GameStateCaches,
    current_ticks: u64,
) -> Vec<Ship> {
    let mut res = vec![];
    let docking_ship_ids: HashSet<Uuid> = HashSet::from_iter(ships.iter().filter_map(|s| {
        let long_act = s
            .long_actions
            .iter()
            .filter(|la| matches!(la, LongAction::Dock { .. }))
            .nth(0);
        if let Some(_la) = long_act {
            return Some(s.id);
        }
        return None;
    }));
    let undocking_ship_ids: HashSet<Uuid> = HashSet::from_iter(ships.iter().filter_map(|s| {
        let long_act = s
            .long_actions
            .iter()
            .filter(|la| matches!(la, LongAction::Undock { .. }))
            .nth(0);
        if let Some(_la) = long_act {
            return Some(s.id);
        }
        return None;
    }));

    for mut ship in ships.clone() {
        if docking_ship_ids.contains(&ship.id)
            || undocking_ship_ids.contains(&ship.id)
            || !update_options
                .limit_area
                .contains_vec(&ship.spatial.position)
        {
            ship.trajectory = vec![];
            res.push(ship);
            continue;
        }
        if !ship.docked_at.is_some() {
            match &ship.movement_definition {
                Movement::None => panic!("ship has no movement, cannot update"),
                Movement::ShipMonotonous { .. } => {
                    let max_shift = ship.movement_definition.get_max_speed() * elapsed as f64;

                    if let Some(target) = ship.navigate_target {
                        let ship_pos = ship.spatial.position.clone();
                        let dist = target.euclidean_distance(&ship_pos);
                        let dir = target.subtract(&ship_pos);
                        ship.spatial.rotation_rad =
                            dir.angle_rad_signed(&Vec2f64 { x: 1.0, y: 0.0 });
                        if dist > 0.0 {
                            ship.trajectory = trajectory::build_trajectory_to_point(
                                &ship.spatial,
                                &target,
                                &ship.movement_definition,
                                update_every_ticks,
                            );
                            if dist > max_shift {
                                let new_pos = move_ship_towards(&target, &ship_pos, max_shift);
                                ship.set_from(&new_pos);
                            } else {
                                ship.set_from(&target);
                                ship.navigate_target = None;
                            }
                        } else {
                            ship.navigate_target = None;
                        }
                    } else if let Some(target) = ship.dock_target {
                        if let Some(planet) = indexes
                            .bodies_by_id
                            .get(&ObjectSpecifier::Planet { id: target })
                        {
                            let ship_pos = ship.spatial.position.clone();
                            let planet_anchor = indexes
                                .bodies_by_id
                                .get(&planet.get_movement().get_anchor_spec())
                                .unwrap();
                            ship.trajectory = trajectory::build_trajectory_to_planet(
                                ship_pos,
                                planet,
                                planet_anchor,
                                &ship.movement_definition,
                                update_every_ticks,
                                current_ticks,
                                indexes,
                                caches,
                            );
                            if let Some(first) = ship.trajectory.clone().get(0) {
                                let dir = first.subtract(&ship_pos);
                                ship.spatial.rotation_rad =
                                    dir.angle_rad_signed(&Vec2f64 { x: 1.0, y: 0.0 });
                                let new_pos = move_ship_towards(first, &ship_pos, max_shift);
                                ship.set_from(&new_pos);
                            }
                        } else {
                            eprintln!("Attempt to navigate to non-existent planet {}", target);
                            ship.dock_target = None;
                        }
                    } else {
                        ship.navigate_target = None;
                    }
                }
                Movement::ShipAccelerated { .. } => {
                    let target_point = if let Some(target) = ship.navigate_target {
                        Some(target)
                    } else if let Some(target) = ship.dock_target {
                        if let Some(planet) = indexes
                            .bodies_by_id
                            .get(&ObjectSpecifier::Planet { id: target })
                        {
                            Some(planet.get_spatial().position)
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    let (mut gas, mut turn, mut brake) = (0.0, 0.0, 0.0);

                    if let Some(target_point) = target_point {
                        if let Some(first) = ship.trajectory_v2.get_next(&ship.spatial) {
                            // steer towards next point, normal flow
                            (gas, turn, brake) = guide_accelerated_ship_to_point(
                                &first.spatial,
                                &ship.spatial,
                                &ship.movement_definition,
                                elapsed,
                            );
                        } else {
                            let tr_res = build_trajectory_accelerated(
                                TrajectoryRequest::StartAndStopPoint { to: target_point },
                                &ship.movement_definition,
                                &ship.spatial,
                            );

                            match &tr_res {
                                TrajectoryResult::Success(trajectory) => {
                                    ship.trajectory_v2 =
                                        TrajectoryResult::Success(trajectory.clone());
                                }
                                _ => {
                                    ship.trajectory_v2 = tr_res;
                                    ship.navigate_target = None;
                                    ship.dock_target = None;
                                    res.push(ship);
                                    continue;
                                }
                            };
                        }
                    }

                    // no matter what, ship movement must continue physically
                    let movement_clone = ship.movement_definition.clone();
                    update_accelerated_movement(
                        elapsed,
                        &mut ship.spatial,
                        &movement_clone,
                        gas,
                        turn,
                        brake,
                        1.0,
                    );
                    ship.markers = markers_to_string(gas, turn, brake);
                }
                _ => panic!("unsupported kind of movement for ship navigation"),
            }
        }
        res.push(ship);
    }
    res
}

pub fn guide_accelerated_ship_to_point(
    target: &SpatialProps,
    current: &SpatialProps,
    mov: &Movement,
    elapsed: i64,
) -> (f64, f64, f64) {
    guide_accelerated_object(target, elapsed, 1e-6, current, mov)
}

pub const MIN_OBJECT_SPEED_PER_TICK: f64 = 1e-13;
// 0.1 unit per second per second (to allow speeding up from zero)
pub const MIN_OBJECT_TURN_SPEED_RAD_PER_TICK: f64 = 1e-14;

impl Movement {
    pub fn is_none(&self) -> bool {
        match self {
            Movement::None => true,
            _ => false,
        }
    }

    pub fn get_brake_acc(&self) -> f64 {
        match self {
            Movement::ShipAccelerated { brake_acc, .. } => *brake_acc,
            _ => 0.0,
        }
    }
    pub fn get_max_speed(&self) -> f64 {
        match self {
            Movement::ShipAccelerated {
                max_linear_speed, ..
            } => *max_linear_speed,
            Movement::ShipMonotonous { move_speed, .. } => *move_speed,
            _ => 0.0,
        }
    }

    pub fn get_max_rotation_speed(&self) -> f64 {
        match self {
            Movement::ShipAccelerated {
                max_rotation_speed, ..
            } => *max_rotation_speed,
            Movement::ShipMonotonous { turn_speed, .. } => *turn_speed,
            _ => 0.0,
        }
    }

    pub fn get_current_angular_acceleration(&self) -> f64 {
        match self {
            Movement::ShipAccelerated { acc_angular, .. } => *acc_angular,
            _ => 0.0,
        }
    }

    pub fn get_angular_speed(&self) -> f64 {
        match self {
            Movement::ShipMonotonous { turn_speed, .. } => *turn_speed,
            Movement::ShipAccelerated { max_turn_speed, .. } => *max_turn_speed,
            _ => 0.0,
        }
    }

    pub fn get_current_linear_acceleration(&self) -> f64 {
        match self {
            Movement::None => 0.0,
            Movement::ShipMonotonous { .. } => 0.0,
            Movement::ShipAccelerated { acc_linear, .. } => *acc_linear,
            Movement::RadialMonotonous { .. } => 0.0,
            Movement::AnchoredStatic { .. } => 0.0,
        }
    }

    pub fn get_linear_drag(&self) -> f64 {
        match self {
            Movement::None => 0.0,
            Movement::ShipMonotonous { .. } => 0.0,
            Movement::ShipAccelerated { linear_drag, .. } => *linear_drag,
            Movement::RadialMonotonous { .. } => 0.0,
            Movement::AnchoredStatic { .. } => 0.0,
        }
    }
    pub fn get_anchor_relative_position(&self) -> &Option<Vec2f64> {
        match self {
            Movement::RadialMonotonous {
                relative_position, ..
            } => relative_position,
            _ => panic!("bad movement, it doesn't have anchor relative position"),
        }
    }

    pub fn get_anchor_id(&self) -> Uuid {
        match self {
            Movement::RadialMonotonous { anchor, .. } => anchor
                .get_id()
                .map(|ik| match ik {
                    IdKind::Uuid(id) => id,
                    IdKind::Int(_) => panic!("Unsupported int-based anchor id"),
                })
                .expect("anchor without id for movement"),
            Movement::AnchoredStatic { anchor } => anchor
                .get_id()
                .map(|ik| match ik {
                    IdKind::Uuid(id) => id,
                    IdKind::Int(_) => panic!("Unsupported int-based anchor id"),
                })
                .expect("anchor without id for movement"),
            _ => panic!("cannot get anchor for movement without an anchor"),
        }
    }

    pub fn get_anchor_spec(&self) -> &ObjectSpecifier {
        match self {
            Movement::RadialMonotonous { anchor, .. } => anchor,
            Movement::AnchoredStatic { anchor } => anchor,
            _ => panic!("cannot get anchor for movement without an anchor"),
        }
    }

    #[deprecated(
        since = "0.8.7",
        note = "this method is needed for non-periodic orbit movements support, however they should not exist"
    )]
    pub fn get_orbit_speed(&self) -> f64 {
        todo!()
    }

    pub fn set_start_phase(&mut self, new_phase: u32) {
        match self {
            Movement::RadialMonotonous {
                phase, start_phase, ..
            } => {
                *phase = Some(new_phase);
                *start_phase = new_phase;
            }
            _ => panic!("Cannot set phase to movement without phase"),
        }
    }
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, PartialEq)]
#[serde(tag = "tag")]
pub enum Movement {
    None,
    ShipMonotonous {
        move_speed: f64,
        turn_speed: f64,
    },
    // no handling implemented for this one yet, it's just a design
    ShipAccelerated {
        max_linear_speed: f64,
        max_rotation_speed: f64,
        linear_drag: f64,
        acc_linear: f64,
        max_turn_speed: f64,
        acc_angular: f64,
        brake_acc: f64,
    },
    RadialMonotonous {
        // instead of defining the speed, in order
        // for interpolation optimization to work, we
        // need to restrict possible locations of the planet
        // so it's fully periodical, e.g. such P exists that position(t = P) = initial,
        // position (t  = 2P) = initial, etc
        full_period_ticks: f64,
        anchor: ObjectSpecifier,
        relative_position: Option<Vec2f64>,
        phase: Option<u32>,
        start_phase: u32,
    },
    AnchoredStatic {
        anchor: ObjectSpecifier,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ManualMoveUpdate {
    pub position: Vec2f64,
    pub rotation: f64,
}

// and undocking!
pub fn interpolate_docking_ships_position(
    state: &mut GameState,
    location_idx: usize,
    update_options: &UpdateOptions,
) {
    let planets_read = state.locations[location_idx].planets.clone();
    let planets_by_id = index_planets_by_id(&planets_read);
    let docking_ship_ids: HashMap<Uuid, LongAction> =
        HashMap::from_iter(state.locations[location_idx].ships.iter().filter_map(|s| {
            let long_act = s
                .long_actions
                .iter()
                .filter(|la| matches!(la, LongAction::Dock { .. }))
                .nth(0);
            if let Some(la) = long_act {
                return Some((s.id, la.clone()));
            }
            return None;
        }));
    let undocking_ship_ids: HashMap<Uuid, LongAction> =
        HashMap::from_iter(state.locations[location_idx].ships.iter().filter_map(|s| {
            let long_act = s
                .long_actions
                .iter()
                .filter(|la| matches!(la, LongAction::Undock { .. }))
                .nth(0);
            if let Some(la) = long_act {
                return Some((s.id, la.clone()));
            }
            return None;
        }));
    for ship in state.locations[location_idx].ships.iter_mut() {
        if !update_options
            .limit_area
            .contains_vec(&ship.spatial.position)
        {
            continue;
        }
        if let Some(long_act) = docking_ship_ids.get(&ship.id) {
            match long_act {
                LongAction::Dock {
                    start_pos,
                    to_planet,
                    percentage,
                    ..
                } => {
                    if let Some(planet) = planets_by_id.get(&to_planet) {
                        let target = planet.spatial.position.clone();
                        let ship_pos = ship.spatial.position.clone();
                        let dir = target.subtract(&ship_pos);
                        ship.spatial.rotation_rad =
                            dir.angle_rad_signed(&Vec2f64 { x: 1.0, y: 0.0 });
                        ship.spatial.position.x = world::lerp(
                            start_pos.x,
                            planet.spatial.position.x,
                            *percentage as f64 / 100.0,
                        );
                        ship.spatial.position.y = world::lerp(
                            start_pos.y,
                            planet.spatial.position.y,
                            *percentage as f64 / 100.0,
                        );
                    }
                }
                _ => {}
            }
        } else if let Some(long_act) = undocking_ship_ids.get(&ship.id) {
            match long_act {
                LongAction::Undock {
                    from_planet,
                    end_pos,
                    percentage,
                    ..
                } => {
                    if let Some(planet) = planets_by_id.get(&from_planet) {
                        let from_pos = planet.spatial.position.clone();
                        let ship_pos = ship.spatial.position.clone();
                        let dir = ship_pos.subtract(&from_pos);
                        ship.spatial.rotation_rad =
                            dir.angle_rad_signed(&Vec2f64 { x: 1.0, y: 0.0 });
                        ship.spatial.position.x =
                            world::lerp(from_pos.x, end_pos.x, *percentage as f64 / 100.0);
                        ship.spatial.position.y =
                            world::lerp(from_pos.y, end_pos.y, *percentage as f64 / 100.0);
                    }
                }
                _ => {}
            }
        }
    }
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum RotationMovement {
    None,
    Monotonous {
        full_period_ticks: f64,
        // positive => counter-clockwise
        phase: Option<u32>,
        start_phase: u32,
    },
}

impl RotationMovement {
    pub fn set_phase(&mut self, new_phase: Option<u32>) {
        match self {
            RotationMovement::None => {}
            RotationMovement::Monotonous { phase, .. } => *phase = new_phase,
        }
    }

    pub fn get_phase(&self) -> &Option<u32> {
        match self {
            RotationMovement::None => &None,
            RotationMovement::Monotonous { phase, .. } => phase,
        }
    }
}

pub fn update_initiate_ship_docking_by_navigation(
    state: &mut GameState,
    location_idx: usize,
    prng: &mut Pcg64Mcg,
) {
    let ships = &state.locations[location_idx].ships;
    let planets_by_id = index_planets_by_id(&state.locations[location_idx].planets);
    let mut to_dock = vec![];
    for i in 0..ships.len() {
        let ship = &ships[i];
        if let Some(t) = ship.dock_target {
            if let Some(planet) = planets_by_id.get(&t) {
                let planet_pos = planet.spatial.position.clone();
                let ship_pos = ship.spatial.position.clone();
                if planet_pos.euclidean_distance(&ship_pos)
                    < (planet.spatial.radius * planet.spatial.radius * SHIP_DOCKING_RADIUS_COEFF)
                        .max(MIN_SHIP_DOCKING_RADIUS)
                {
                    let docks_in_progress = ship
                        .long_actions
                        .iter()
                        .any(|a| matches!(a, LongAction::Dock { .. }));

                    if !docks_in_progress {
                        to_dock.push((
                            ShipIdx {
                                location_idx,
                                ship_idx: i,
                            },
                            planet.id,
                        ))
                    }
                }
            }
        }
    }
    for (ship_idx, planet_id) in to_dock {
        try_start_long_action_ship_only(
            state,
            &ship_idx,
            LongActionStart::DockInternal {
                to_planet: planet_id,
            },
            prng,
        );
    }
}

pub fn update_docked_ships_position(loc: &mut Location, indexes: &GameStateIndexes) {
    for ship in loc.ships.iter_mut() {
        if let Some(docked_at) = ship.docked_at {
            if let Some(planet) = indexes.planets_by_id.get(&docked_at) {
                ship.spatial.position.x = planet.spatial.position.x;
                ship.spatial.position.y = planet.spatial.position.y;
            }
        }
    }
}
