use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use std::sync::{mpsc, Arc, Mutex, RwLock};
use std::sync::{MutexGuard, RwLockWriteGuard};

use crate::api_struct::AiTrait;
use crate::world_events::GameEvent;
use crossbeam::channel::{bounded, Receiver, Sender};
use lazy_static::lazy_static;
use rand::prelude::SmallRng;
use uuid::Uuid;

use crate::abilities::*;
use crate::dialogue::DialogueTable;
use crate::dialogue_dto::Dialogue;
use crate::get_prng;
use crate::perf::Sampler;
use crate::rooms_api::create_room_impl;
use crate::states::StateContainer;
use crate::substitutions::substitute_notification_texts;
use crate::world;
use crate::world::{spawn_ship, GameMode, GameState, Player};
use crate::xcast::XCast;
use crate::{cargo_rush, indexing, pirate_defence, tutorial};

lazy_static! {
    pub static ref EVENTS: (
        Arc<Mutex<Sender<GameEvent>>>,
        Arc<Mutex<Receiver<GameEvent>>>
    ) = {
        let (sender, receiver) = bounded::<GameEvent>(128);
        (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
    };
}

pub fn handle_events(
    _d_table: &mut DialogueTable,
    receiver: &mut Receiver<GameEvent>,
    cont: &mut RwLockWriteGuard<StateContainer>,
    _d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
) -> Vec<(Uuid, Option<Dialogue>)> {
    // not used now since dialogue changes got moved to world_events
    let dialogue_changes = vec![];
    let mut prng = get_prng();

    loop {
        let result = receiver.try_recv();
        match result {
            Ok(event) => {
                match event.clone() {
                    GameEvent::ShipSpawned { player_id, .. } => {
                        if player_id.is_none() {
                            // the event handler here is only used for player ship spawn
                            continue;
                        }
                        let player_id = player_id.unwrap();
                        let state = crate::states::select_state_mut(cont, player_id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();
                        crate::main_ws_server::send_event_to_client(
                            event.clone(),
                            XCast::Unicast(player_id, state.id),
                        );
                    }
                    GameEvent::RoomJoined {
                        player_id,
                        personal,
                        mode,
                        ..
                    } => {
                        if personal && mode == GameMode::Tutorial {
                            fire_event(GameEvent::DialogueTriggerRequest {
                                dialogue_name: "tutorial_start".to_owned(),
                                player_id,
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
                    GameEvent::ShipDocked { .. } => {
                        warn!(
                            "Ship docking triggering should happen in world, there's some bug here"
                        );
                    }
                    GameEvent::ShipUndocked { .. } => {
                        // intentionally do nothing
                    }
                    GameEvent::DialogueTriggerRequest { .. } => {
                        warn!("Dialogue triggering should happen in world, there's some bug here");
                    }
                    GameEvent::CargoQuestTriggerRequest { player_id } => {
                        let state = crate::states::select_state_mut(cont, player_id);
                        if state.is_none() {
                            warn!("event in non-existent state");
                            continue;
                        }
                        let state = state.unwrap();
                        let planets = state.locations[0].planets.clone();
                        if let Some(player) = indexing::find_my_player_mut(state, player_id) {
                            cargo_rush::generate_random_quest(
                                player,
                                &planets.clone(),
                                None,
                                &mut prng,
                            );
                        }
                        substitute_notification_texts(state, HashSet::from_iter(vec![player_id]));
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
                    GameEvent::CreateRoomRequest {
                        mode,
                        room_id,
                        bots_seed,
                    } => {
                        create_room_impl(cont, &mode, room_id, bots_seed);
                    }
                    GameEvent::PirateSpawn { .. } => {
                        warn!(
                            "Pirate spawn handling should happen in world, there's some bug here"
                        );
                    }
                    GameEvent::KickPlayerRequest { player_id } => {
                        crate::main_ws_server::kick_player(player_id);
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
    // log!(format!("fire event {:?}", ev));
    let sender = &mut EVENTS.0.lock().unwrap();
    if let Err(e) = sender.try_send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    }
}
