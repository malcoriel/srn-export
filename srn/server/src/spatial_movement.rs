use crate::vec2::{deg_to_rad, Vec2f64};
use crate::world::{Location, Movement, Ship, SpatialProps, MIN_OBJECT_SPEED_PER_TICK};
use crate::world_actions::MoveAxisParam;

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
        }
        Movement::ShipAccelerated { .. } => {
            maybe_drop_outdated_movement_marker(current_tick, ship, client, skip_throttle_drop);
            let gas_marker = &ship.movement_markers.gas;
            let sign: f64 = gas_marker
                .as_ref()
                .map_or(0.0, |m| if m.forward { 1.0 } else { -1.0 });
            // even if sign is zero (no gas), the drag still has to apply
            let new_speed = project_ship_linear_speed_by_acceleration(elapsed_micro, ship, sign);
            ship.movement_definition.set_linear_speed(new_speed);
            let new_pos = project_ship_movement_by_speed(elapsed_micro, ship, 1.0);
            ship.set_from(&new_pos);
        }
        Movement::RadialMonotonous { .. } => {}
        Movement::AnchoredStatic { .. } => {}
    }

    let (new_move, new_rotation) = if let Some(params) = &ship.movement_markers.turn {
        if (params.last_tick as i32 - current_tick as i32).abs()
            > MANUAL_MOVEMENT_INACTIVITY_DROP_MS
        {
            (None, None)
        } else {
            let sign = if params.forward { 1.0 } else { -1.0 };
            let diff =
                deg_to_rad(SHIP_TURN_SPEED_DEG * elapsed_micro as f64 / 1000.0 / 1000.0 * sign);
            (Some(params.clone()), Some(ship.spatial.rotation_rad + diff))
        }
    } else {
        (None, None)
    };
    ship.movement_markers.turn = new_move;
    if let Some(new_rotation) = new_rotation {
        ship.spatial.rotation_rad = new_rotation;
    }
}

pub fn update_spatial_of_object(
    elapsed_micro: i64, // can be negative for the sake of applying StopGas in the past
    spatial: &mut SpatialProps,
) {
    if spatial.velocity.euclidean_len() < MIN_OBJECT_SPEED_PER_TICK {
        spatial.velocity = Vec2f64::zero();
        return;
    }
    project_spatial_position_by_velocity(elapsed_micro, spatial);
}

fn maybe_drop_outdated_movement_marker(
    current_tick: u32,
    ship: &mut Ship,
    client: bool,
    skip_throttle_drop: bool,
) -> bool {
    // returns true if dropped
    let new_move = if let Some(params) = &mut ship.movement_markers.gas {
        if should_throttle_drop_manual_gas(current_tick, client, skip_throttle_drop, params) {
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

fn should_throttle_drop_manual_gas(
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
    let distance =
        ship.movement_definition.get_current_linear_speed_per_tick() * elapsed_micro as f64 * sign;
    let shift = Vec2f64 { x: 0.0, y: 1.0 }
        .rotate(ship.spatial.rotation_rad)
        .scalar_mul(distance);
    let new_pos = ship.spatial.position.add(&shift);
    new_pos
}

fn project_spatial_position_by_velocity(elapsed_micro: i64, spatial: &mut SpatialProps) {
    let distance = spatial.velocity.euclidean_len() * elapsed_micro as f64;
    let shift = Vec2f64 { x: 0.0, y: 1.0 }
        .rotate(spatial.rotation_rad)
        .scalar_mul(distance);
    spatial.position = spatial.position.add(&shift);
}

fn project_ship_linear_speed_by_acceleration(elapsed_micro: i64, ship: &Ship, sign: f64) -> f64 {
    let current_speed = ship.movement_definition.get_current_linear_speed_per_tick();
    let apply_drag = if sign == 0.0 { 1.0 } else { 0.0 };
    let change =
        ship.movement_definition.get_current_linear_acceleration() * elapsed_micro as f64 * sign
            - ship.movement_definition.get_linear_drag()
                * apply_drag
                * elapsed_micro as f64
                * (current_speed.signum());
    // eprintln!(
    //     "current {current_speed} change {change} elapsed {elapsed_micro} acc {}",
    //     ship.movement_definition.get_current_linear_acceleration()
    // );
    current_speed + change
}

pub const SHIP_TURN_SPEED_DEG: f64 = 90.0;
pub const ORB_SPEED_MULT: f64 = 1.0;

pub fn update_objects_spatial_movement(
    location: &mut Location,
    elapsed_micro: i64,
    current_tick: u32,
    client: bool,
) {
    for ship in location.ships.iter_mut() {
        update_ship_manual_movement(elapsed_micro, current_tick, ship, client, false);
    }
    for wreck in location.wrecks.iter_mut() {
        update_spatial_of_object(elapsed_micro, &mut wreck.spatial)
    }
}
