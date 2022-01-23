use rand::prelude::SmallRng;
use crate::{fire_event, prng_id, Room, world};
use crate::bots;
use world::GameState;

use world::{GameEvent, Player};
use crate::api_struct::{AiTrait, new_bot};
use crate::bots::add_bot;
use crate::world::fire_saved_event;

pub fn on_create_room(room: &mut Room, prng: &mut SmallRng) {
    let traits = Some(vec![AiTrait::CargoRushHauler]);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(),prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(),prng_id(prng)), prng);
}

pub fn on_ship_docked(state: &mut GameState, player: Option<Player>) {
    if let Some(player) = player {
        fire_saved_event(state, GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
    }
}
