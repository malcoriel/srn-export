use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use std::sync::{mpsc, Arc, Mutex, RwLock};
use std::sync::{MutexGuard, RwLockWriteGuard};

use crossbeam::channel::{bounded, Receiver, Sender};
use lazy_static::lazy_static;
use uuid::Uuid;
use crate::api_struct::AiTrait;

use crate::abilities::{*};
use crate::dialogue::DialogueTable;
use crate::dialogue_dto::Dialogue;
use crate::{indexing, pirate_defence, tutorial};
use crate::perf::Sampler;
use crate::rooms_api::create_room_impl;
use crate::states::StateContainer;
use crate::substitutions::substitute_notification_texts;
use crate::world;
use crate::world::{spawn_ship, GameEvent, GameMode, GameState, Player};
use crate::xcast::XCast;
use crate::get_prng;

lazy_static! {
    pub static ref EVENTS: (
        Arc<Mutex<Sender<GameEvent>>>,
        Arc<Mutex<Receiver<GameEvent>>>
    ) = {
        let (sender, receiver) = bounded::<GameEvent>(128);
        (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
    };
}

pub fn get_ev_state<'a, 'b> (ev: &'b GameEvent, cont: &'a mut RwLockWriteGuard<StateContainer>) -> Option<&'a mut GameState> {
    let res = match ev {
        GameEvent::ShipDocked { state_id, .. } => {
            let state = crate::states::select_state_by_id_mut(cont, state_id.clone());
            state
        }
        _ => None
    };
    if res.is_none() {
        warn!("Event {:?} in non-existent state");
    }
    return res;
}

pub fn handle_events(
    d_table: &mut DialogueTable,
    receiver: &mut Receiver<GameEvent>,
    cont: &mut RwLockWriteGuard<StateContainer>,
    d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
) -> Vec<(Uuid, Option<Dialogue>)> {
    let mut dialogue_changes = vec![];
    let mut prng = get_prng();

    loop {
        let result = receiver.try_recv();
        match result {
            Ok(event) => {
                match event.clone() {
                    GameEvent::ShipSpawned { player, .. } => {
                        if player.is_none() {
                            // the event handler here is only used for player ship spawn
                            continue;
                        }
                        let player = player.unwrap();
                        let state = crate::states::select_state_mut(cont, player.id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();
                        crate::main_ws_server::send_event_to_client(
                            event.clone(),
                            XCast::Unicast(player.id, state.id),
                        );
                    }
                    GameEvent::RoomJoined {
                        player,
                        personal,
                        mode,
                        ..
                    } => {
                        if personal && mode == GameMode::Tutorial {
                            fire_event(GameEvent::DialogueTriggerRequest {
                                dialogue_name: "tutorial_start".to_owned(),
                                player: player.clone(),
                            });
                        }
                    }
                    GameEvent::ShipDied { state_id, .. } => {
                        let state = crate::states::select_state_by_id_mut(cont, state_id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();
                        crate::main_ws_server::send_event_to_client(
                            event.clone(),
                            XCast::Broadcast(state.id),
                        );
                    }
                    GameEvent::GameEnded { state_id } => {
                        crate::main_ws_server::send_event_to_client(
                            event.clone(),
                            XCast::Broadcast(state_id),
                        );
                    }
                    GameEvent::GameStarted { state_id } => {
                        crate::main_ws_server::send_event_to_client(
                            event.clone(),
                            XCast::Broadcast(state_id),
                        );
                    }
                    GameEvent::Unknown => {
                        // intentionally do nothing
                    }
                    GameEvent::ShipDocked {
                        player, ship, planet, ..
                    } => {
                        if let Some(state) = get_ev_state( &event, cont)
                        {
                            match state.mode {
                                GameMode::Unknown => {}
                                GameMode::CargoRush => {}
                                GameMode::Tutorial => {
                                    tutorial::on_ship_docked(state, player);
                                }
                                GameMode::Sandbox => {}
                                GameMode::PirateDefence => {
                                    pirate_defence::on_ship_land(state, ship,planet);
                                }
                            }
                        }
                    }
                    GameEvent::ShipUndocked { .. } => {
                        // intentionally do nothing
                    }
                    GameEvent::DialogueTriggerRequest {
                        dialogue_name,
                        player,
                    } => {
                        let state = crate::states::select_state_mut(cont, player.id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();
                        if let Some(script) = d_table.get_by_name(dialogue_name.as_str()) {
                            let d_states = DialogueTable::get_player_d_states(d_states, &player);
                            d_table.trigger_dialogue(
                                script,
                                &mut dialogue_changes,
                                &player,
                                d_states,
                                state,
                            )
                        } else {
                            eprintln!("No dialogue found by name {}", dialogue_name)
                        }
                    }
                    GameEvent::CargoQuestTriggerRequest { player } => {
                        let state = crate::states::select_state_mut(cont, player.id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();
                        let planets = state.locations[0].planets.clone();
                        if let Some(player) = indexing::find_my_player_mut(state, player.id) {
                            world::generate_random_quest(player, &planets.clone(), None, &mut prng);
                        }
                        substitute_notification_texts(state, HashSet::from_iter(vec![player.id]));
                    }
                    GameEvent::TradeTriggerRequest { player, .. } => {
                        let state = crate::states::select_state_mut(cont, player.id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();

                        crate::main_ws_server::send_event_to_client(
                            event.clone(),
                            XCast::Unicast(state.id, player.id),
                        );
                    }
                    GameEvent::CreateRoomRequest { mode, room_id } => {
                        create_room_impl(cont, &mode, room_id);
                    }
                    GameEvent::PirateSpawn { at, state_id } => {
                        let state = crate::states::select_state_by_id_mut(cont, state_id);
                        if state.is_none() {
                            warn!("pirate spawn in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();

                        pirate_defence::on_pirate_spawn(state, at);
                    }
                }
            }
            Err(_) => {
                break;
            }
        }
    }
    dialogue_changes
}

pub fn fire_event(ev: GameEvent) {
    let sender = &mut EVENTS.0.lock().unwrap();
    if let Err(e) = sender.try_send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    }
}
