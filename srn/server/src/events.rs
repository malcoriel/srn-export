use std::collections::HashMap;

use crossbeam::channel::{bounded, Receiver, Sender};
use uuid::Uuid;

use crate::cast::XCast;
use crate::dialogue::{Dialogue, DialogueTable};
use crate::perf::Sampler;
use crate::world::{GameEvent, GameState};
use crate::EVENTS;

pub fn handle_events(
    d_table: &mut DialogueTable,
    receiver: &mut Receiver<GameEvent>,
    state: &mut GameState,
    d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
    mut sampler: Sampler,
) -> (Vec<(Uuid, Option<Dialogue>)>, Sampler) {
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
                sampler = d_table_argument.try_trigger(
                    state,
                    d_states,
                    &mut res_argument,
                    player_argument,
                    sampler,
                );
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
                GameEvent::Unknown => {
                    // intentionally do nothing
                }
                GameEvent::ShipDocked { .. } => {
                    // intentionally do nothing
                }
                GameEvent::ShipUndocked { .. } => {
                    // intentionally do nothing
                }
                GameEvent::DialogueTriggered { dialogue_name, player } => {
                    if let Some(script) = d_table.get_by_name(dialogue_name.as_str()) {
                        let d_states = DialogueTable::get_player_d_states(d_states, &player);
                        d_table.trigger_dialogue(script, &mut res, &player, d_states, state)
                    }
                }
            }
        } else {
            break;
        }
    }
    (res, sampler)
}

pub fn fire_event(ev: GameEvent) {
    let sender = &mut EVENTS.lock().unwrap().0;
    if let Err(e) = sender.send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    } else {
    }
}
