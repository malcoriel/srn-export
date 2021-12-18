use crate::world;
use crate::bots;
use world::GameState;
use crate::api_struct::{new_bot, Room};
use crate::bots::add_bot;

pub fn setup_bots(room: &mut Room) {
    add_bot(room, new_bot(None));
    add_bot(room, new_bot(None));
    add_bot(room, new_bot(None));
    add_bot(room, new_bot(None));
}
