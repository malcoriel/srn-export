use crate::{fire_event, world};
use crate::bots;
use world::GameState;
use crate::api_struct::{new_bot, Room};
use crate::bots::add_bot;
use world::{GameEvent, Player};
use crate::world::fire_saved_event;

pub fn setup_bots(room: &mut Room) {
    add_bot(room, new_bot(None));
    // add_bot(room, new_bot(None));
    // add_bot(room, new_bot(None));
    // add_bot(room, new_bot(None));
}

pub fn on_ship_docked(state: &mut GameState, player: Option<Player>) {
    if let Some(player) = player {
        fire_saved_event(state, GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
    }
}
