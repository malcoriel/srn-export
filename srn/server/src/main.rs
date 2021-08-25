#![feature(exclusive_range_pattern)]
#![allow(dead_code)]
#![allow(unused_imports)]
#[macro_use]
extern crate serde_derive;

use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt::{Display, Formatter};
use std::iter::FromIterator;
use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::time::Duration;
use std::{fmt, thread};

use chrono::{DateTime, Local, Utc};
use crossbeam::channel::{bounded, Receiver, Sender};
use itertools::Itertools;
use lazy_static::lazy_static;
use num_traits::FromPrimitive;
use regex::Regex;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::Header;
use rocket::http::Method;
use rocket::{Request, Response};
use rocket_contrib::json::Json;
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;
use serde_derive::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use uuid::*;
use websocket::client::sync::Writer;
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;
use websocket::{Message, OwnedMessage};

use dialogue::{DialogueStates, DialogueTable};
use dialogue_dto::Dialogue;
use net::{
    ClientErr, ClientOpCode, PersonalizeUpdate, ServerToClientMessage, ShipsWrapper,
    SwitchRoomPayload, TagConfirm, Wrapper,
};
use perf::SamplerMarks;
use states::{get_rooms_iter, select_default_state, update_rooms, StateContainer, STATE};
use world::{GameMode, GameState, Player, Ship};
use xcast::XCast;

use crate::api_struct::Room;
use crate::bots::{bot_init, do_bot_actions};
use crate::chat::chat_server;
use crate::dialogue::{execute_dialog_option, DialogueId, DialogueScript, DialogueUpdate};
use crate::indexing::{
    find_and_extract_ship, find_my_player, find_my_player_mut, find_my_ship, find_planet,
};
use crate::perf::Sampler;
use crate::rooms_api::find_room_state_id_by_player_id;
use crate::sandbox::mutate_state;
use crate::ship_action::ShipActionRust;
use crate::states::{
    get_state_id_cont, get_state_id_cont_mut, select_default_state_read, select_state,
    select_state_mut, update_default_state,
};
use crate::substitutions::substitute_notification_texts;
use crate::system_gen::make_tutorial_state;
use crate::vec2::Vec2f64;
use crate::world::{spawn_ship, update_quests, GameEvent, UpdateOptions, AABB};

macro_rules! log {
    ($($t:tt)*) => {
        (println!("log: {}", ($($t)*).to_string()))
    }
}

macro_rules! warn {
    ($($t:tt)*) => {
        (eprintln!("warn: {}", ($($t)*).to_string()))
    }
}

#[allow(unused_macros)]
macro_rules! err {
    ($($t:tt)*) => {
        (eprintln!("err: {}", ($($t)*).to_string()))
    }
}

#[macro_use]
extern crate rocket;
extern crate websocket;
#[macro_use]
extern crate num_derive;

mod abilities;
mod api;
mod api_struct;
mod autofocus;
mod autofocus_test;
mod bots;
mod chat;
mod combat;
mod dialogue;
mod dialogue_dto;
mod dialogue_test;
mod events;
mod indexing;
mod inventory;
mod inventory_test;
mod locations;
mod long_actions;
mod main_ws_server;
mod market;
mod net;
mod notifications;
mod perf;
mod planet_movement;
mod planet_movement_test;
mod random_stuff;
mod rooms_api;
mod sandbox;
mod sandbox_api;
mod ship_action;
mod states;
mod substitutions;
mod substitutions_test;
mod system_gen;
mod tractoring;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
pub mod world;
mod world_test;
mod xcast;

struct LastCheck {
    time: DateTime<Utc>,
}

pub type WSRequest =
    WsUpgrade<std::net::TcpStream, std::option::Option<websocket::server::upgrade::sync::Buffer>>;

lazy_static! {
    static ref DIALOGUE_STATES: Arc<Mutex<Box<DialogueStates>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

lazy_static! {
    static ref DIALOGUE_TABLE: Arc<Mutex<Box<DialogueTable>>> =
        Arc::new(Mutex::new(Box::new(DialogueTable::new())));
}

pub const ENABLE_PERF: bool = false;
const DEBUG_FRAME_STATS: bool = false;
const DEFAULT_SLEEP_MS: u64 = 1;
const BROADCAST_SLEEP_MS: u64 = 500;
const MAX_ERRORS: u32 = 10;
const MAX_ERRORS_SAMPLE_INTERVAL: i64 = 5000;
const MAX_MESSAGES_PER_INTERVAL: u32 = 10;
const MAX_MESSAGE_SAMPLE_INTERVAL_MS: i64 = 200;
pub const DEBUG_PHYSICS: bool = false;
const MIN_SLEEP_TICKS: i32 = 100;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueRequest {
    planet_id: Uuid,
}

fn get_state_clone_read(client_id: Uuid) -> GameState {
    let cont = STATE.read().unwrap();
    return states::select_state(&cont, client_id).clone();
}

fn personalize_player(state: &mut GameState, conn_id: Uuid, update: PersonalizeUpdate) {
    {
        world::force_update_to_now(state);
        state.players.iter_mut().find(|p| p.id == conn_id).map(|p| {
            p.name = update.name;
            p.portrait_name = update.portrait_name;
        });
    }
    {
        let state = state.clone();
        let state_id = state.id.clone();
        main_ws_server::x_cast_state(state, XCast::Broadcast(state_id));
    }
}

fn make_new_human_player(conn_id: Uuid, state: &mut GameState) {
    world::add_player(state, conn_id, false, None);
    world::spawn_ship(state, conn_id, None);
}

fn remove_player(conn_id: Uuid, state: &mut GameState) {
    world::remove_player_from_state(conn_id, state);
    // TODO remove empty personal state
    // cont.states.remove(&conn_id);
}

pub fn new_id() -> Uuid {
    Uuid::new_v4()
}

pub struct CORS();

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to requests",
            kind: Kind::Response,
        }
    }

    async fn on_response<'r>(&self, _request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}

#[launch]
fn rocket() -> rocket::Rocket {
    {
        let mut d_table = DIALOGUE_TABLE.lock().unwrap();
        let scripts: Vec<DialogueScript> = dialogue::gen_scripts();
        for script in scripts {
            d_table.scripts.insert(script.id, script);
        }
    }

    make_thread("websocket_server")
        .spawn(|| {
            main_ws_server::websocket_server();
        })
        .ok();

    make_thread("chat_server")
        .spawn(|| {
            chat_server();
        })
        .ok();

    make_thread("main")
        .spawn(|| {
            main_thread();
        })
        .ok();
    make_thread("broadcast_state")
        .spawn(|| {
            broadcast_state_thread();
        })
        .ok();

    make_thread("dispatcher")
        .spawn(move || main_ws_server::dispatcher_thread())
        .ok();

    make_thread("websocket_server_cleanup")
        .spawn(|| main_ws_server::cleanup_bad_clients_thread())
        .ok();
    // make_thread("rooms_api_cleanup")
    //     .spawn(|| rooms_api::cleanup_empty_rooms())
    //     .ok();

    sandbox::init_saved_states();
    rocket::ignite()
        .attach(CORS())
        .mount("/api", routes![api::get_version, api::get_health])
        .mount(
            "/api/sandbox",
            routes![
                sandbox_api::get_saved_states,
                sandbox_api::save_current_state,
                sandbox_api::load_saved_state,
                sandbox_api::load_random_state,
                sandbox_api::load_seeded_state,
                sandbox_api::save_state_into_json,
                sandbox_api::load_clean_state
            ],
        )
        .mount(
            "/api/rooms",
            routes![
                rooms_api::get_rooms,
                rooms_api::create_room,
                rooms_api::get_rooms_for_mode
            ],
        )
}

fn make_thread(name: &str) -> std::thread::Builder {
    std::thread::Builder::new().name(name.to_string())
}

fn broadcast_state_thread() {
    loop {
        let diff = {
            let start = Local::now();
            let mut cont = STATE.write().unwrap();
            broadcast_all_states(&mut cont);
            (Local::now() - start).num_milliseconds()
        };
        // log!(format!("broadcast duration={}ms", diff));
        thread::sleep(Duration::from_millis(
            (BROADCAST_SLEEP_MS as i64 - diff).max(0) as u64,
        ));
    }
}

const PERF_CONSUME_TIME: i64 = 30 * 1000 * 1000;
const BOT_ACTION_TIME: i64 = 200 * 1000;
const EVENT_TRIGGER_TIME: i64 = 500 * 1000;
const FRAME_BUDGET_TICKS: i32 = 15 * 1000;
const FRAME_STATS_COUNT: i32 = 2000;

lazy_static! {
    pub static ref SUB_RE: Regex = Regex::new(r"s_\w+").unwrap();
}

fn main_thread() {
    let mut prng = world::gen_rng();
    let mut d_table = *DIALOGUE_TABLE.lock().unwrap().clone();
    let mut last = Local::now();
    {
        let mut bots = bots::BOTS.lock().unwrap();
        let mut cont = STATE.write().unwrap();
        bot_init(&mut *bots, select_default_state(&mut cont));
    }
    let mut marks_holder = vec![];
    for mark in SamplerMarks::iter() {
        marks_holder.push(mark.to_string());
    }
    let mut sampler = Sampler::new(marks_holder);
    let mut sampler_consume_elapsed = 0;
    let mut bot_action_elapsed = 0;
    let mut events_elapsed = 0;
    let mut frame_count = 0;
    let mut over_budget_frame = 0;
    let mut shortcut_frame = 0;

    loop {
        frame_count += 1;
        if frame_count >= FRAME_STATS_COUNT {
            let over_budget_pct = over_budget_frame as f32 / frame_count as f32 * 100.0;
            let shortcut_pct = shortcut_frame as f32 / frame_count as f32 * 100.0;
            if DEBUG_FRAME_STATS {
                log!(format!(
                    "Frame stats: shortcut {:.2}%, over-budget {:.2}% for {}",
                    shortcut_pct, over_budget_pct, frame_count
                ));
            }
            frame_count = 0;
            over_budget_frame = 0;
            shortcut_frame = 0;
        }
        sampler.budget = FRAME_BUDGET_TICKS;
        let total_mark = sampler.start(SamplerMarks::MainTotal as u32);
        let locks_id = sampler.start(SamplerMarks::Locks as u32);
        let mut cont = STATE.write().unwrap();
        let mut d_states = DIALOGUE_STATES.lock().unwrap();
        let mut bots = bots::BOTS.lock().unwrap();
        if sampler.end_top(locks_id) < 0 {
            shortcut_frame += 1;
            continue;
        }

        let now = Local::now();
        let elapsed = now - last;
        last = now;
        let elapsed_micro = elapsed.num_milliseconds() * 1000;
        let update_id = sampler.start(SamplerMarks::Update as u32);
        let (updated_state, updated_sampler) = world::update_world(
            select_default_state(&mut cont).clone(),
            elapsed_micro,
            false,
            sampler,
            UpdateOptions {
                disable_hp_effects: false,
                limit_area: AABB::maxed(),
            },
        );
        sampler = updated_sampler;
        update_default_state(&mut cont, updated_state);

        if sampler.end_top(update_id) < 0 {
            shortcut_frame += 1;
            continue;
        }

        let personal_id = sampler.start(SamplerMarks::PersonalStates as u32);
        let updated_rooms = get_rooms_iter(&cont)
            .filter_map(|room| {
                // if state.players.len() == 0 {
                //     return None;
                // }
                let (new_state, _) = world::update_world(
                    room.state.clone(),
                    elapsed_micro,
                    false,
                    Sampler::empty(),
                    UpdateOptions {
                        disable_hp_effects: false,
                        limit_area: AABB::maxed(),
                    },
                );
                let room_clone = Room {
                    id: room.id,
                    name: room.name.clone(),
                    state: new_state,
                };
                Some(room_clone)
            })
            .collect();
        update_rooms(&mut cont, updated_rooms);
        if sampler.end_top(personal_id) < 0 {
            shortcut_frame += 1;
            continue;
        }

        let quests_mark = sampler.start(SamplerMarks::Quests as u32);
        update_quests(select_default_state(&mut cont), &mut prng);
        if sampler.end_top(quests_mark) < 0 {
            shortcut_frame += 1;
            continue;
        }

        let d_states = &mut **d_states;
        {
            let mut_state_bots = select_default_state(&mut cont);

            if bot_action_elapsed > BOT_ACTION_TIME {
                let bots_mark = sampler.start(SamplerMarks::Bots as u32);
                let bots = &mut *bots;
                do_bot_actions(mut_state_bots, bots, d_states, &d_table, bot_action_elapsed);
                bot_action_elapsed = 0;
                if sampler.end_top(bots_mark) < 0 {
                    shortcut_frame += 1;
                    continue;
                }
            } else {
                bot_action_elapsed += elapsed_micro;
            }
        }

        if events_elapsed > EVENT_TRIGGER_TIME {
            let events_mark = sampler.start(SamplerMarks::Events as u32);
            let receiver = &mut events::EVENTS.1.lock().unwrap();
            let res = events::handle_events(&mut d_table, receiver, &mut cont, d_states);
            for (client_id, dialogue) in res {
                let corresponding_state_id = get_state_id_cont_mut(&mut cont, client_id);
                main_ws_server::unicast_dialogue_state(client_id, dialogue, corresponding_state_id);
            }
            if sampler.end_top(events_mark) < 0 {
                shortcut_frame += 1;
                continue;
            }
            events_elapsed = 0;
        } else {
            events_elapsed += elapsed_micro;
        }

        let cleanup_mark = sampler.start(SamplerMarks::ShipCleanup as u32);
        let existing_player_ships = select_default_state(&mut cont)
            .players
            .iter()
            .map(|p| p.ship_id.clone())
            .filter(|s| s.is_some())
            .map(|s| s.unwrap())
            .collect::<Vec<_>>();

        let len = select_default_state(&mut cont).locations.len();
        for idx in 0..len {
            sampler = cleanup_nonexistent_ships(
                select_default_state(&mut cont),
                &existing_player_ships,
                idx,
                sampler,
            );
        }
        if sampler.end_top(cleanup_mark) < 0 {
            shortcut_frame += 1;
            continue;
        }

        sampler.end(total_mark);

        sampler_consume_elapsed += elapsed_micro;
        if sampler_consume_elapsed > PERF_CONSUME_TIME {
            sampler_consume_elapsed = 0;
            let (sampler_out, metrics) = sampler.consume();
            sampler = sampler_out;
            if ENABLE_PERF {
                log!(format!(
                    "performance stats over {} sec \n{}",
                    PERF_CONSUME_TIME / 1000 / 1000,
                    metrics.join("\n")
                ));
            }
        }

        if sampler.budget < 0 {
            over_budget_frame += 1;
            log!(format!("Frame over budget by {}µs", -sampler.budget));
        }
        let sleep_remaining = sampler.budget.max(0);
        if sleep_remaining > MIN_SLEEP_TICKS {
            thread::sleep(Duration::from_micros(sleep_remaining as u64));
        }
    }
}

fn broadcast_all_states(cont: &mut RwLockWriteGuard<StateContainer>) {
    let read_state = select_default_state(cont);
    main_ws_server::x_cast_state(read_state.clone(), XCast::Broadcast(read_state.id));
    for room in get_rooms_iter(cont) {
        main_ws_server::x_cast_state(room.state.clone(), XCast::Broadcast(room.state.id));
    }
}

pub fn cleanup_nonexistent_ships(
    state: &mut GameState,
    existing_player_ships: &Vec<Uuid>,
    location_idx: usize,
    mut sampler: Sampler,
) -> Sampler {
    let new_ships = state.locations[location_idx]
        .ships
        .clone()
        .into_iter()
        .filter(|s| existing_player_ships.contains(&s.id))
        .collect::<Vec<_>>();
    let old_ships_len = state.locations[location_idx].ships.len();
    let new_ships_len = new_ships.len();
    state.locations[location_idx].ships = new_ships;

    if new_ships_len != old_ships_len {
        let ship_cleanup_id = sampler.start(SamplerMarks::ShipCleanup as u32);
        main_ws_server::multicast_ships_update_excluding(
            state.locations[location_idx].ships.clone(),
            None,
            state.id,
        );
        sampler.end(ship_cleanup_id);
    }
    sampler
}

pub fn fire_event(ev: GameEvent) {
    events::fire_event(ev);
}
