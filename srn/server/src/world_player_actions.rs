use crate::indexing::{
    find_my_ship_mut, find_player_idx_by_ship_id, find_ship_index, GameStateIndexes,
};
use crate::long_actions::try_start_long_action;
use crate::ship_action::{Action, MoveAxisParam};
use crate::world::{undock_ship, GameState, Ship, ShipWithTime};
use crate::{trajectory, Vec2f64};
use rand::prelude::*;
use uuid::Uuid;

const MAX_ALLOWED_DISTANCE_TICKS: i64 = 10 * 1000 * 1000;

pub fn find_closest_ship_history(
    ship_id: Uuid,
    at_ticks: u64,
    state: &GameState,
) -> Option<&ShipWithTime> {
    if state.ticks < at_ticks {
        // future lookups do not make sense, and the latest history item should be always
        // (at most) SHIP_HISTORY_GAP_TICKS away from the current ticks
        return None;
    }
    return state.ship_history.get(&ship_id).and_then(|items| {
        // optimize for too far in the past, it's pointless to allow much desync for a lag-compensating tool
        // no .abs() because this should only cover the 'too much in the past' case
        if items.len() > 0
            && (items[0].at_ticks as i64 - at_ticks as i64) > MAX_ALLOWED_DISTANCE_TICKS
        {
            return None;
        }
        // assume the amount of items is small (currently 10), so no tricks are necessary,
        // e.g. writing custom 'closest' binary search
        let mut min_distance_ticks = 1000 * 1000;
        let mut found_index = 0;
        for i in 0..items.len() {
            let item = &items[i];
            let diff = (item.at_ticks as i64 - at_ticks as i64).abs();
            if diff < min_distance_ticks {
                min_distance_ticks = diff;
                found_index = i;
            }
        }
        return Some(&items[found_index]);
    });
}

pub fn world_update_handle_player_action(
    state: &mut GameState,
    action: Action,
    prng: &mut SmallRng,
    state_clone: &GameState,
) {
    match action {
        Action::LongActionStart {
            long_action_start,
            player_id,
        } => {
            try_start_long_action(state, player_id, long_action_start, prng);
        }
        Action::Gas { player_id, .. } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::StopGas { player_id } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.movement_markers.gas = None;
            }
        }
        Action::Reverse { player_id } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: false,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::TurnRight { player_id } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.movement_markers.turn = Some(MoveAxisParam {
                    forward: false,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::TurnLeft { player_id } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.movement_markers.turn = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::StopTurn { player_id } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
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
        _ => {
            warn!(format!(
                "action {:?} cannot be handled by world_update_handle_player_action",
                action
            ))
        }
    }
}

fn find_earliest_ship_history_by(
    ship_id: Uuid,
    from_ticks: u64,
    state: &GameState,
    checker: fn(&Ship) -> bool,
) -> Option<&ShipWithTime> {
    state.ship_history.get(&ship_id).and_then(|items| {
        items
            .iter()
            .find(|st| st.at_ticks >= from_ticks && checker(&st.ship))
    })
}
