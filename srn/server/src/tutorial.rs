use crate::world::{fire_saved_event, GameEvent, GameState, Player};

pub fn on_ship_docked(state: &mut GameState, player: Option<Player>) {
    if let Some(player) = player {
        fire_saved_event(state,GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
    }
}
