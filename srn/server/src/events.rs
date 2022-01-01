use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use std::sync::{Arc, mpsc, Mutex, RwLock};
use std::sync::{MutexGuard, RwLockWriteGuard};

use crossbeam::channel::{bounded, Receiver, Sender};
use lazy_static::lazy_static;
use uuid::Uuid;
use rand::prelude::SmallRng;
use crate::api_struct::AiTrait;

use crate::abilities::{*};
use crate::dialogue::DialogueTable;
use crate::dialogue_dto::Dialogue;
use crate::{cargo_rush, indexing, pirate_defence, tutorial};
use crate::perf::Sampler;
use crate::rooms_api::create_room_impl;
use crate::states::StateContainer;
use crate::substitutions::substitute_notification_texts;
use crate::world;
use crate::world::{GameEvent, GameMode, GameState, Player, spawn_ship};
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

pub fn get_ev_state<'a, 'b>(ev: &'b GameEvent, cont: &'a mut RwLockWriteGuard<StateContainer>) -> Option<&'a mut GameState> {
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
                        ..
                    } => {
                        log!("Ship docking triggering should happen in world, there's some bug here");
                    }
                    GameEvent::ShipUndocked { .. } => {
                        // intentionally do nothing
                    }
                    GameEvent::DialogueTriggerRequest {
                        ..
                    } => {
                        log!("Dialogue triggering should happen in world, there's some bug here");
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
                    GameEvent::PirateSpawn { .. } => {
                        log!("Pirate spawn handling should happen in world, there's some bug here");
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
