use crate::indexing::{find_my_ship_mut, GameStateIndexes};
use crate::long_actions::try_start_long_action;
use crate::ship_action::{MoveAxisParam, PlayerActionRust};
use crate::world::{GameState, Ship};
use crate::Vec2f64;
use rand::prelude::*;
use uuid::Uuid;

const MAX_ALLOWED_DISTANCE_TICKS: i64 = 10 * 1000 * 1000;

pub fn find_closest_ship_history(ship_id: Uuid, at_ticks: u64, state: &GameState) -> Option<&Ship> {
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
        return Some(&items[found_index].ship);
    });
}

pub fn world_update_handle_player_action(
    state: &mut GameState,
    action: PlayerActionRust,
    prng: &mut SmallRng,
    state_clone: &GameState,
) {
    match action {
        PlayerActionRust::LongActionStart {
            long_action_start,
            player_id,
        } => {
            try_start_long_action(state, player_id, long_action_start, prng);
        }
        PlayerActionRust::Gas {
            player_id,
            at_ticks,
        } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                let _rebased = if let Some(at_ticks) = at_ticks {
                    if let Some(past_ship) =
                        find_closest_ship_history(ship.id, at_ticks, state_clone)
                    {
                        // if out-of-order is impossible due to WS/TCP usage, then the only rebasing that has to be done, is
                        // checking if there are no actions before at_ticks and then retroactively applying
                        // the requested action in past. Strictly speaking, for interaction with other
                        // actions that consider ship position (e.g. shooting), it's incorrect - but I'm willing
                        // to ignore it for now
                        let dir = Vec2f64 { x: 0.0, y: 1.0 }.rotate(past_ship.rotation);
                        let shift = dir.scalar_mul(
                            past_ship
                                .movement_definition
                                .get_current_linear_move_speed_per_tick()
                                * (state_clone.ticks as f64 - at_ticks as f64),
                        );
                        // technically, such patching should also patch the whole history,
                        // as not only the curren version has changed, but all its past too
                        ship.set_from(&ship.as_vec().add(&shift));
                        true
                    } else {
                        false
                    }
                } else {
                    false
                };
                // regardless of rebased or not, the current status of ship shouldbe the requested one
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        PlayerActionRust::StopGas {
            player_id,
            at_ticks,
        } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.movement_markers.gas = None;
            }
        }
        PlayerActionRust::Reverse {
            player_id,
            at_ticks,
        } => {
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
        _ => {
            warn!(format!(
                "action {:?} cannot be handled by world_update_handle_player_action",
                action
            ))
        }
    }
}
