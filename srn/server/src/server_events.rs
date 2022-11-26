use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use std::sync::{mpsc, Arc, Mutex, RwLock};
use std::sync::{MutexGuard, RwLockWriteGuard};

use crate::api_struct::AiTrait;
use crate::indexing::ObjectSpecifier;
use crate::world_events::GameEvent;
use crossbeam::channel::{bounded, Receiver, Sender};
use lazy_static::lazy_static;

use rand::prelude::*;
use rand_pcg::Pcg64Mcg;
use uuid::Uuid;

use crate::abilities::*;
use crate::dialogue::Dialogue;
use crate::dialogue::DialogueTable;
use crate::perf::Sampler;
use crate::rooms_api::create_room_impl;
use crate::states::StateContainer;
use crate::substitutions::substitute_notification_texts;
use crate::world;
use crate::world::{spawn_ship, GameMode, GameState, Player};
use crate::xcast::XCast;
use crate::{cargo_rush, indexing, pirate_defence, tutorial};
use crate::{get_prng, SamplerMarks};

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
    receiver: &mut Receiver<GameEvent>,
    cont: &mut RwLockWriteGuard<StateContainer>,
    mut sampler: Sampler,
) -> Sampler {
    let mut prng = get_prng();

    loop {
        let result = receiver.try_recv();
        match result {
            Ok(event) => {
                match event.clone() {
                    GameEvent::ShipSpawned { player_id, .. } => {
                        if player_id.is_none() {
                            // the event handler here is only used for player ship spawn to notify client
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
                                target: None,
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
                        warn!("Ship docking should happen in world events, there's some bug here");
                    }
                    GameEvent::ShipUndocked { .. } => {
                        // intentionally do nothing
                    }
                    GameEvent::DialogueTriggerRequest { .. } => {
                        warn!("Dialogue triggering should happen in world events, there's some bug here");
                    }
                    GameEvent::CargoQuestTriggerRequest { player_id } => {
                        // so far, used only in tutorial, so mostly irrelevant for world events and can be kept here
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
                    GameEvent::TradeDialogueTriggerRequest { .. } => {
                        warn!("TradeDialogueTriggerRequest should happen in world events, there's some bug here");
                    }
                    GameEvent::CreateRoomRequest {
                        mode,
                        room_id,
                        bots_seed,
                    } => {
                        let mark = sampler.start(SamplerMarks::EventsCreateRoom as u32);
                        create_room_impl(cont, &mode, room_id, bots_seed);
                        sampler.end(mark);
                    }
                    GameEvent::PirateSpawn { .. } => {
                        warn!(
                            "Pirate spawn handling should happen in world, there's some bug here"
                        );
                    }
                    GameEvent::QuitPlayerRequest { player_id } => {
                        crate::main_ws_server::kick_player(player_id);
                    }
                    GameEvent::SandboxCommandRequest { .. } => {
                        // no commands yet require server-level handling, but it's not a mistake too
                    }
                }
            }
            Err(_) => {
                break;
            }
        }
    }
    sampler
}

pub fn fire_event(ev: GameEvent) {
    // log!(format!("fire event {:?}", ev));
    let sender = &mut EVENTS.0.lock().unwrap();
    if let Err(e) = sender.try_send(ev.clone()) {
        eprintln!("Failed to send event {:?}, err {}", ev, e);
    }
}
