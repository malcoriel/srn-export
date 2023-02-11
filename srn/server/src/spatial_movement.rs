use crate::vec2::{deg_to_rad, Vec2f64};
use crate::world::{
    Location, Movement, Ship, SpatialProps, MIN_OBJECT_SPEED_PER_TICK,
    MIN_OBJECT_TURN_SPEED_RAD_PER_TICK,
};
use crate::world_actions::MoveAxisParam;
use std::f64::consts::PI;

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
                ship.spatial.rotation_rad = new_rotation;
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
            update_accelerated_ship_movement(elapsed_micro, ship, gas_sign, turn_sign);
        }
        Movement::RadialMonotonous { .. } => {}
        Movement::AnchoredStatic { .. } => {}
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
    update_spatial_by_velocities(elapsed_micro, spatial);
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
    let shift = Vec2f64 { x: 0.0, y: 1.0 }
        .rotate(ship.spatial.rotation_rad)
        .scalar_mul(distance);
    let new_pos = ship.spatial.position.add(&shift);
    new_pos
}

// somewhat an artificial drag to prevent infinite movement. It is a = m/s^2
pub const SPACE_DRAG_PER_TICK_PER_TICK: f64 = 1.0 / 1e6 / 1e6;
pub const TURN_DRAG_RAD_PER_TICK: f64 = PI / 1e6 / 1e6; // really high drag to prevent too much drifting

fn update_spatial_by_velocities(elapsed_micro: i64, spatial: &mut SpatialProps) {
    let linear_drag = &spatial
        .velocity
        .normalize()
        .unwrap_or(Vec2f64::zero())
        .scalar_mul(SPACE_DRAG_PER_TICK_PER_TICK * elapsed_micro as f64);
    spatial.velocity = spatial.velocity.subtract(&linear_drag);
    let shift = &spatial.velocity.scalar_mul(elapsed_micro as f64);
    spatial.position = spatial.position.add(&shift);
    if spatial.velocity.euclidean_len() <= MIN_OBJECT_SPEED_PER_TICK {
        spatial.velocity = Vec2f64::zero();
    }

    let angular_drag =
        spatial.angular_velocity.signum() * TURN_DRAG_RAD_PER_TICK * elapsed_micro as f64;
    spatial.angular_velocity -= angular_drag;
    spatial.rotation_rad += spatial.angular_velocity * elapsed_micro as f64;
    spatial.rotation_rad = spatial.rotation_rad % (2.0 * PI);
    if spatial.angular_velocity.abs() <= MIN_OBJECT_TURN_SPEED_RAD_PER_TICK {
        spatial.angular_velocity = 0.0;
    }
}

fn update_accelerated_ship_movement(
    elapsed_micro: i64,
    ship: &mut Ship,
    gas_sign: f64,
    turn_sign: f64,
) {
    if gas_sign != 0.0 {
        let linear_drag = ship
            .spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(SPACE_DRAG_PER_TICK_PER_TICK * elapsed_micro as f64);
        // negate drag if ship is actively moving to prevent wrong expectations
        ship.spatial.velocity.add(&linear_drag);
    }
    if turn_sign != 0.0 {
        let angular_drag =
            ship.spatial.angular_velocity.signum() * TURN_DRAG_RAD_PER_TICK * elapsed_micro as f64;
        // negate drag if ship is actively turning to prevent wrong expectations
        ship.spatial.angular_velocity += angular_drag;
    }
    let thrust_dir = Vec2f64 { x: 0.0, y: 1.0 }.rotate(ship.spatial.rotation_rad);
    let space_acceleration = thrust_dir.scalar_mul(
        ship.movement_definition.get_current_linear_acceleration()
            * elapsed_micro as f64
            * gas_sign,
    );
    ship.spatial.velocity = ship.spatial.velocity.add(&space_acceleration);
    let max_speed = ship.movement_definition.get_max_speed();
    if ship.spatial.velocity.euclidean_len() > max_speed {
        ship.spatial.velocity = ship
            .spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(max_speed);
    }
    ship.spatial.angular_velocity += turn_sign
        * ship.movement_definition.get_current_angular_acceleration()
        * elapsed_micro as f64;
    let max_rotation_speed = ship.movement_definition.get_max_rotation_speed();
    if ship.spatial.angular_velocity.abs() > max_rotation_speed {
        ship.spatial.angular_velocity = ship.spatial.angular_velocity.signum() * max_rotation_speed;
    }

    update_spatial_by_velocities(elapsed_micro, &mut ship.spatial);
}

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
    // every other object that cannot change its speed itself, will drift
    for wreck in location.wrecks.iter_mut() {
        update_spatial_of_object(elapsed_micro, &mut wreck.spatial)
    }
}
