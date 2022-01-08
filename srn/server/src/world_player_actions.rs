use rand::prelude::*;
use uuid::Uuid;
use crate::long_actions::try_start_long_action;
use crate::ship_action::PlayerActionRust;
use crate::world::GameState;

pub fn world_update_handle_player_action(state: &mut GameState, action: PlayerActionRust, prng: &mut SmallRng) {
    match action {
        PlayerActionRust::LongActionStart { long_action_start, player_id, .. } => {
            try_start_long_action(state, player_id, long_action_start, prng);
        }
        _ => { warn!(format!("action {:?} cannot be handled by world_update_handle_player_action", action)) }
    }
}
