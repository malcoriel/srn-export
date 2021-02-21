use std::collections::{HashMap, HashSet};

use crossbeam::channel::{bounded, Receiver, Sender};
use uuid::Uuid;

use crate::xcast::XCast;
use crate::dialogue::{Dialogue, DialogueTable};
use crate::perf::Sampler;
use crate::world::{GameEvent, GameState, Player};
use crate::{EVENTS, StateContainer};
use std::sync::{MutexGuard, RwLockWriteGuard};

pub fn handle_events(
    d_table: &mut DialogueTable,
    receiver: &mut Receiver<GameEvent>,
    cont: &mut RwLockWriteGuard<StateContainer>,
    d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
    mut sampler: Sampler,
) -> (Vec<(Uuid, Option<Dialogue>)>, Sampler) {
    let mut res = vec![];

    let in_tutorials = crate::IN_TUTORIAL.lock().unwrap();
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
                let state = select_state(cont, &in_tutorials, &player);
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
                    let state = select_state(cont, &in_tutorials, &player);
                    crate::send_event_to_client(event.clone(), XCast::Unicast(player.id, state.id) );
                }
                GameEvent::RoomJoined { player, in_tutorial } => {
                    if in_tutorial {
                        fire_event(GameEvent::DialogueTriggered { dialogue_name: "tutorial_start".to_owned(), player: player.clone() });
                    }
                }
                GameEvent::ShipDied { player, .. } => {
                    let state = select_state(cont, &in_tutorials, &player);
                    crate::send_event_to_client(event.clone(), XCast::Broadcast(state.id));
                }
                GameEvent::GameEnded { .. } => {
                    crate::send_event_to_client(event.clone(), XCast::Broadcast(cont.state.id));
                }
                GameEvent::GameStarted { .. } => {
                    crate::send_event_to_client(event.clone(), XCast::Broadcast(cont.state.id));
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
                    let state = select_state(cont, &in_tutorials, &player);
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

fn select_state<'a, 'b, 'c>(cont: &'a mut RwLockWriteGuard<StateContainer>,
                            in_tutorials: &'b MutexGuard<HashSet<Uuid>>, player: &'c Player) -> &'a mut GameState {
    if in_tutorials.contains(&player.id) {
        cont.tutorial_states.get_mut(&player.id).unwrap()
    } else { &mut cont.state }
}

pub fn fire_event(ev: GameEvent) {
    let sender = &mut EVENTS.lock().unwrap().0;
    if let Err(e) = sender.send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    } else {
    }
}
