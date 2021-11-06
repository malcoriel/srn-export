use crate::events::fire_event;
use crate::world::{GameEvent, GameState};

pub fn on_ship_docked(state: &mut GameState, event: GameEvent) {
    if let Some(player) = event.player {
        fire_event(GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
    }
}
