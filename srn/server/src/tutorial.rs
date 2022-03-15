use crate::world::{fire_saved_event, GameState, Player};
use crate::world_events::GameEvent;
use uuid::Uuid;

pub fn on_ship_docked(state: &mut GameState, player_id: Option<Uuid>) {
    if let Some(player_id) = player_id {
        fire_saved_event(
            state,
            GameEvent::DialogueTriggerRequest {
                dialogue_name: "basic_planet".to_owned(),
                player_id,
            },
        );
    }
}
