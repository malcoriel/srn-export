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
            update_accelerated_ship_movement(
                elapsed_micro,
                &mut ship.spatial,
                &mut ship.movement_definition,
                gas_sign,
                turn_sign,
                brake_sign,
            );
        }
        Movement::RadialMonotonous { .. } => {}
        Movement::AnchoredStatic { .. } => {}
    }
}

pub fn update_spatial_of_object(
    elapsed_micro: i64, // can be negative for the sake of applying StopGas in the past
    spatial: &mut SpatialProps,
    debug: bool,
) {
    if spatial.velocity.euclidean_len() < MIN_OBJECT_SPEED_PER_TICK {
        spatial.velocity = Vec2f64::zero();
        return;
    }
    update_spatial_by_velocities(elapsed_micro, spatial, debug);
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
pub const TURN_DRAG_RAD_PER_TICK: f64 = PI / 1e6 / 1e6; // really high drag to prevent too much drifting

fn update_spatial_by_velocities(elapsed_micro: i64, spatial: &mut SpatialProps, _debug: bool) {
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

fn update_spatial_by_velocities_projectile(
    elapsed_micro: i64,
    spatial: &mut SpatialProps,
    _debug: bool,
) {
    let mut true_velocity = spatial.velocity.clone();
    let linear_drag = &true_velocity
        .normalize()
        .unwrap_or(Vec2f64::zero())
        .scalar_mul(SPACE_DRAG_PER_TICK_PER_TICK * elapsed_micro as f64);
    true_velocity = true_velocity.subtract(&linear_drag);
    let shift = &true_velocity.scalar_mul(elapsed_micro as f64);
    spatial.position = spatial.position.add(&shift);
    if true_velocity.euclidean_len() <= MIN_OBJECT_SPEED_PER_TICK {
        true_velocity = Vec2f64::zero();
    }
    spatial.velocity = true_velocity;

    // intentionally make angular drag x 10 to prevent complexity in swaying guided projectiles
    let angular_drag =
        spatial.angular_velocity.signum() * TURN_DRAG_RAD_PER_TICK * 10.0 * elapsed_micro as f64;
    spatial.angular_velocity -= angular_drag;
    spatial.rotation_rad += spatial.angular_velocity * elapsed_micro as f64;
    spatial.rotation_rad = spatial.rotation_rad % (2.0 * PI);
    if spatial.angular_velocity.abs() <= MIN_OBJECT_TURN_SPEED_RAD_PER_TICK {
        spatial.angular_velocity = 0.0;
    }
}

pub fn update_accelerated_ship_movement(
    elapsed_micro: i64,
    spatial: &mut SpatialProps,
    movement_definition: &Movement,
    gas_sign: f64,
    turn_sign: f64,
    brake_sign: f64,
) {
    if gas_sign != 0.0 {
        let linear_drag = spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(SPACE_DRAG_PER_TICK_PER_TICK * elapsed_micro as f64);
        // negate drag by adding it again, if ship is actively moving to prevent wrong expectations
        spatial.velocity = spatial.velocity.add(&linear_drag);
    }

    if brake_sign != 0.0 {
        let linear_brake = spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(movement_definition.get_brake_acc() * elapsed_micro as f64);
        spatial.velocity = spatial.velocity.subtract(&linear_brake);
    }

    if turn_sign != 0.0 {
        let angular_drag =
            spatial.angular_velocity.signum() * TURN_DRAG_RAD_PER_TICK * elapsed_micro as f64;
        // negate drag if ship is actively turning to prevent wrong expectations
        spatial.angular_velocity += angular_drag;
    }
    let thrust_dir = Vec2f64 { x: 1.0, y: 0.0 }.rotate(spatial.rotation_rad);
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
    spatial.angular_velocity +=
        turn_sign * movement_definition.get_current_angular_acceleration() * elapsed_micro as f64;
    let max_rotation_speed = movement_definition.get_max_rotation_speed();
    if spatial.angular_velocity.abs() > max_rotation_speed {
        spatial.angular_velocity = spatial.angular_velocity.signum() * max_rotation_speed;
    }

    update_spatial_by_velocities(elapsed_micro, spatial, false);
}

pub fn update_accelerated_projectile_movement(
    elapsed_micro: i64,
    spatial: &mut SpatialProps,
    movement_definition: &Movement,
    gas_sign: f64,
    turn_sign: f64,
    brake_sign: f64,
) {
    if gas_sign != 0.0 {
        let linear_drag = spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(SPACE_DRAG_PER_TICK_PER_TICK * elapsed_micro as f64);
        // negate drag if ship is actively moving to prevent wrong expectations
        spatial.velocity = spatial.velocity.add(&linear_drag);
    }

    if brake_sign != 0.0 {
        let linear_brake = spatial
            .velocity
            .normalize()
            .unwrap_or(Vec2f64::zero())
            .scalar_mul(movement_definition.get_brake_acc() * elapsed_micro as f64);
        spatial.velocity = spatial.velocity.subtract(&linear_brake);
    }

    if turn_sign != 0.0 {
        let angular_drag = spatial.angular_velocity.signum()
            * TURN_DRAG_RAD_PER_TICK
            * 10.0
            * elapsed_micro as f64;
        // negate drag if ship is actively turning to prevent wrong expectations
        spatial.angular_velocity += angular_drag;
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
    spatial.angular_velocity +=
        turn_sign * movement_definition.get_current_angular_acceleration() * elapsed_micro as f64;
    let max_rotation_speed = movement_definition.get_max_rotation_speed();
    if spatial.angular_velocity.abs() > max_rotation_speed {
        spatial.angular_velocity = spatial.angular_velocity.signum() * max_rotation_speed;
    }

    update_spatial_by_velocities_projectile(elapsed_micro, spatial, false);
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
    // every other object that cannot change its speed itself, will drift - basically, unguided physics
    for wreck in location.wrecks.iter_mut() {
        update_spatial_of_object(elapsed_micro, &mut wreck.spatial, false)
    }
}

pub fn align_rotation_with_velocity(sp: &mut SpatialProps) {
    let base = Vec2f64 { x: 1.0, y: 0.0 };
    let velocity_angle = sp.velocity.angle_rad(&base);
    sp.rotation_rad = velocity_angle;
}
