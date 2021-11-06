use crate::events::fire_event;
use crate::world::{GameEvent, GameState, Player};

pub fn on_ship_docked(_state: &mut GameState, player: Option<Player>) {
    if let Some(player) = player {
        fire_event(GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
    }
}
