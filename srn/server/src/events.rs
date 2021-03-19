use std::collections::{HashMap, HashSet};
use std::sync::{Arc, mpsc, Mutex, RwLock};
use std::sync::{MutexGuard, RwLockWriteGuard};

use crossbeam::channel::{bounded, Receiver, Sender};
use lazy_static::lazy_static;
use uuid::Uuid;

use crate::{StateContainer, world};
use crate::dialogue::DialogueTable;
use crate::dialogue_dto::Dialogue;
use crate::perf::Sampler;
use crate::world::{GameEvent, GameMode, GameState, Player};
use crate::xcast::XCast;

lazy_static! {
    pub static ref EVENTS: (Arc<Mutex<Sender<GameEvent>>>, Arc<Mutex<Receiver<GameEvent>>>) =
    {
        let (sender, receiver) = bounded::<GameEvent>(128);
        (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
    };
}

pub fn handle_events(
    d_table: &mut DialogueTable,
    receiver: &mut Receiver<GameEvent>,
    cont: &mut RwLockWriteGuard<StateContainer>,
    d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>
) -> Vec<(Uuid, Option<Dialogue>)> {
    let mut res = vec![];

    loop {
        if let Ok(event) = receiver.try_recv() {
            match event.clone() {
                GameEvent::ShipSpawned { player, .. } => {
                    let state = crate::select_mut_state(cont, player.id);
                    crate::send_event_to_client(event.clone(), XCast::Unicast(player.id, state.id) );
                }
                GameEvent::RoomJoined { player, personal, mode } => {
                    if personal && mode == GameMode::Tutorial {
                        fire_event(GameEvent::DialogueTriggerRequest { dialogue_name: "tutorial_start".to_owned(), player: player.clone() });
                    }
                }
                GameEvent::ShipDied { player, .. } => {
                    let state = crate::select_mut_state(cont, player.id);
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
                GameEvent::ShipDocked { player, .. } => {
                    let state = crate::select_mut_state(cont, player.id);
                    if state.mode != GameMode::Tutorial {
                        fire_event(GameEvent::DialogueTriggerRequest { dialogue_name: "basic_planet".to_owned(), player: player.clone() });
                    }
                }
                GameEvent::ShipUndocked { .. } => {
                    // intentionally do nothing
                }
                GameEvent::DialogueTriggerRequest { dialogue_name, player } => {
                    let state = crate::select_mut_state(cont, player.id);
                    if let Some(script) = d_table.get_by_name(dialogue_name.as_str()) {
                        let d_states = DialogueTable::get_player_d_states(d_states, &player);
                        d_table.trigger_dialogue(script, &mut res, &player, d_states, state)
                    } else {
                        eprintln!("No dialogue found by name {}", dialogue_name)
                    }
                }
                GameEvent::CargoQuestTriggerRequest { player } => {
                    let state = crate::select_mut_state(cont, player.id);
                    let planets = state.planets.clone();
                    if let Some(player) = world::find_my_player_mut(state, player.id) {
                        player.quest = world::generate_random_quest(&planets, None);
                    }
                }
                GameEvent::TradeTriggerRequest { player, .. } => {
                    let state = crate::select_mut_state(cont, player.id);
                    crate::send_event_to_client(event.clone(), XCast::Unicast(state.id, player.id));
                }
            }
        } else {
            break;
        }
    }
    res
}

pub fn fire_event(ev: GameEvent) {
    let sender = &mut EVENTS.0.lock().unwrap();
    if let Err(e) = sender.send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    } else {
    }
}
