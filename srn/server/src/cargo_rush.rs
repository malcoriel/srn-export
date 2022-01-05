use crate::{fire_event, Room, world};
use crate::bots;
use world::GameState;

use world::{GameEvent, Player};
use crate::api_struct::{AiTrait, new_bot};
use crate::bots::add_bot;
use crate::world::fire_saved_event;

pub fn on_create_room(room: &mut Room) {
    let traits = Some(vec![AiTrait::CargoRushHauler]);
    add_bot(room, new_bot(traits.clone()));
    add_bot(room, new_bot(traits.clone()));
    add_bot(room, new_bot(traits.clone()));
    add_bot(room, new_bot(traits.clone()));
}

pub fn on_ship_docked(state: &mut GameState, player: Option<Player>) {
    if let Some(player) = player {
        fire_saved_event(state, GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
    }
}
