use crate::abilities::Ability;
use crate::indexing::{
    find_my_ship_mut, find_player_idx_by_ship_id, find_ship_index, find_ship_mut, GameStateIndexes,
};
use crate::long_actions::{try_start_long_action, try_start_long_action_ship};
use crate::ship_action::{Action, MoveAxisParam};
use crate::world::{undock_ship, GameState, ObjectProperty, Ship, ShipWithTime};
use crate::{indexing, tractoring, trajectory, Vec2f64};
use rand::prelude::*;
use uuid::Uuid;

const MAX_ALLOWED_DISTANCE_TICKS: i64 = 10 * 1000 * 1000;

pub fn world_update_handle_action(
    state: &mut GameState,
    action: Action,
    prng: &mut SmallRng,
    state_clone: &GameState,
) {
    match action {
        Action::LongActionStart {
            long_action_start,
            player_id,
            ship_id,
        } => {
            if let Some(player_id) = player_id {
                try_start_long_action(state, player_id, long_action_start, prng);
            } else {
                if let Some(ship_idx) = find_ship_index(state_clone, ship_id) {
                    try_start_long_action_ship(state, &ship_idx, long_action_start, prng);
                }
            }
        }
        Action::Gas { ship_id, .. } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::StopGas { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.gas = None;
            }
        }
        Action::Reverse { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: false,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::TurnRight { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.turn = Some(MoveAxisParam {
                    forward: false,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::TurnLeft { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.turn = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::StopTurn { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.turn = None;
            }
        }
        Action::Navigate { ship_id, target } => {
            if let Some(idx) = find_ship_index(state_clone, ship_id) {
                undock_ship(
                    state,
                    idx.clone(),
                    false, // technically this code is used on both server & client, but
                    // I know that there are only fire-event side effects that do nothing on client
                    find_player_idx_by_ship_id(state_clone, ship_id),
                    prng,
                );
                let mut ship = &mut state.locations[idx.location_idx].ships[idx.ship_idx];
                let ship_pos = ship.as_vec();
                ship.dock_target = None;
                ship.navigate_target = Some(target);
                ship.trajectory = trajectory::build_trajectory_to_point(
                    ship_pos,
                    &target,
                    &ship.movement_definition,
                );
                ship.movement_markers.gas = None;
                ship.movement_markers.turn = None;
            }
        }
        Action::DockNavigate { ship_id, target } => {
            if let Some(ship_idx) = find_ship_index(state, ship_id) {
                let ship = &state_clone.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

                if let Some(planet) = indexing::find_planet(state_clone, &target) {
                    if planet
                        .properties
                        .contains(&ObjectProperty::UnlandablePlanet)
                        && !ship.abilities.contains(&Ability::BlowUpOnLand)
                    {
                        // technically some logic bug signifier, but it also conflicts with one of the test hacks
                        // in 'can start long action TransSystemJump' test
                        // warn!(format!(
                        //     "Attempt to land on unlandable planet {} by ship {}, ignoring.",
                        //     planet.id, ship.id
                        // ));
                    } else {
                        undock_ship(
                            state,
                            ship_idx.clone(),
                            false, // same reasoning as with Navigate
                            find_player_idx_by_ship_id(state_clone, ship.id),
                            prng,
                        );
                        let ship =
                            &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

                        let ship_pos = ship.as_vec();
                        let planet_pos = Vec2f64 {
                            x: planet.x,
                            y: planet.y,
                        };

                        ship.navigate_target = None;
                        ship.dock_target = None;
                        ship.dock_target = Some(target);
                        ship.trajectory = trajectory::build_trajectory_to_point(
                            ship_pos,
                            &planet_pos,
                            &ship.movement_definition,
                        );
                        ship.movement_markers.gas = None;
                        ship.movement_markers.turn = None;
                    }
                }
            }
        }
        Action::Tractor { target, ship_id } => {
            if let Some(ship_idx) = find_ship_index(state, ship_id) {
                let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
                tractoring::update_ship_tractor(
                    target,
                    ship,
                    &state_clone.locations[ship_idx.location_idx].minerals,
                    &state_clone.locations[ship_idx.location_idx].containers,
                );
            }
        }
        _ => {
            warn!(format!(
                "action {:?} cannot be handled by world_update_handle_player_action",
                action
            ))
        }
    }
}

pub fn is_world_update_action(act: &Action) -> bool {
    matches!(
        act,
        Action::LongActionStart { .. }
            | Action::Navigate { .. }
            | Action::Gas { .. }
            | Action::StopGas { .. }
            | Action::Reverse { .. }
            | Action::TurnLeft { .. }
            | Action::TurnRight { .. }
            | Action::StopTurn { .. }
            | Action::DockNavigate { .. }
            | Action::Tractor { .. }
    )
}
