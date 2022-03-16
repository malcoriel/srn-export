use crate::indexing::{find_my_ship_mut, GameStateIndexes};
use crate::long_actions::try_start_long_action;
use crate::ship_action::{MoveAxisParam, PlayerActionRust};
use crate::world::GameState;
use rand::prelude::*;
use uuid::Uuid;

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
        PlayerActionRust::Gas { player_id } => {
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
        _ => {
            warn!(format!(
                "action {:?} cannot be handled by world_update_handle_player_action",
                action
            ))
        }
    }
}
