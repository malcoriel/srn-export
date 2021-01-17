use std::collections::HashMap;

use crossbeam::channel::{bounded, Receiver, Sender};
use uuid::Uuid;

use crate::cast::XCast;
use crate::dialogue::{Dialogue, DialogueTable};
use crate::world::{GameEvent, GameState};
use crate::EVENTS;

pub fn handle_events(
    d_table: &DialogueTable,
    receiver: &mut Receiver<GameEvent>,
    state: &mut GameState,
    d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
) -> Vec<(Uuid, Option<Dialogue>)> {
    let mut res = vec![];

    loop {
        if let Ok(event) = receiver.try_recv() {
            let player = match event.clone() {
                GameEvent::ShipDocked { player, .. } => Some(player),
                GameEvent::ShipUndocked { player, .. } => Some(player),
                GameEvent::ShipSpawned { player, .. } => Some(player),
                GameEvent::ShipDied { player, .. } => Some(player),
                _ => None,
            };
            if let Some(player) = player {
                let mut res_argument = &mut res;
                let player_argument = &player;
                let d_table_argument = &d_table;
                d_table_argument.try_trigger(state, d_states, &mut res_argument, player_argument);
            }
            match event.clone() {
                GameEvent::ShipSpawned { player, .. } => {
                    crate::send_event(event.clone(), XCast::Unicast(player.id));
                }
                GameEvent::ShipDied { .. } => {
                    crate::send_event(event.clone(), XCast::Broadcast);
                }
                GameEvent::GameEnded { .. } => {
                    crate::send_event(event.clone(), XCast::Broadcast);
                }
                GameEvent::GameStarted { .. } => {
                    crate::send_event(event.clone(), XCast::Broadcast);
                }
                _ => {}
            }
        } else {
            break;
        }
    }
    res
}

pub fn fire_event(ev: GameEvent) {
    let sender = &mut EVENTS.lock().unwrap().0;
    if let Err(e) = sender.send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    } else {
    }
}
