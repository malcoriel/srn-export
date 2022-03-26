#![feature(exclusive_range_pattern)]
#![feature(path_file_prefix)]
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_macros)]
#[macro_use]
extern crate serde_derive;

use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt::{Display, Formatter};
use std::iter::FromIterator;
use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::time::Duration;
use std::{env, fmt, thread};

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

use bots::BOT_ACTION_TIME_TICKS;
use dialogue::{DialogueStates, DialogueTable, Dialogue};
use lockfree::map::Map as LockFreeMap;
use lockfree::set::Set as LockFreeSet;
use net::{
    ClientErr, ClientOpCode, PersonalizeUpdate, ServerToClientMessage, ShipsWrapper,
    SwitchRoomPayload, TagConfirm, Wrapper,
};
use perf::SamplerMarks;
use rand::prelude::SmallRng;
use rand::{thread_rng, RngCore, SeedableRng};
use states::{get_rooms_iter, update_rooms, StateContainer, ROOMS_READ, STATE};
use world::{GameMode, GameState, Player, Ship, SpatialIndexes};
use world_events::GameEvent;
use xcast::XCast;

use crate::api_struct::Room;
use crate::autofocus::build_spatial_index;
use crate::bots::{do_bot_npcs_actions, do_bot_players_actions};
use crate::chat::chat_server;
use crate::dialogue::{execute_dialog_option, DialogueId, DialogueScript, DialogueUpdate};
use crate::indexing::{
    find_and_extract_ship, find_my_player, find_my_player_mut, find_my_ship, find_planet,
};
use crate::perf::Sampler;
use crate::rooms_api::{cleanup_empty_rooms, find_room_state_id_by_player_id};
use crate::sandbox::mutate_state;
use world_actions::Action;
use crate::states::{
    get_rooms_iter_read, get_state_id_cont, get_state_id_cont_mut, select_state, select_state_mut,
};
use crate::substitutions::substitute_notification_texts;
use crate::vec2::Vec2f64;
use crate::world::{spawn_ship, update_rule_specifics, UpdateOptions, AABB};

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

macro_rules! cast {
    ($target: expr, $pat: path) => {{
        if let $pat(a) = $target {
            // #1
            a
        } else {
            panic!("mismatch variant when cast to {}", stringify!($pat)); // #2
        }
    }};
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
mod bots;
mod cargo_rush;
mod chat;
mod combat;
mod dialogue;
mod dialogue_test;
mod fof;
mod indexing;
mod interpolation;
mod inventory;
mod inventory_test;
mod locations;
mod long_actions;
mod main_ws_server;
mod market;
mod net;
mod notifications;
mod perf;
mod pirate_defence;
mod planet_movement;
mod random_stuff;
mod replay;
mod replays_api;
mod resources;
mod rooms_api;
mod sandbox;
mod sandbox_api;
mod server_events;
mod states;
mod substitutions;
mod substitutions_test;
mod system_gen;
mod tractoring;
mod trajectory;
mod tutorial;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
pub mod world;
mod world_actions;
mod world_events;
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

lazy_static! {
    pub static ref ENABLE_PERF: bool = env::var("ENABLE_PERF").is_ok();
}

lazy_static! {
    pub static ref DEBUG_FRAME_STATS: bool = env::var("DEBUG_FRAME_STATS").is_ok();
}

const DEFAULT_SLEEP_MS: u64 = 2;
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

fn get_state_clone_read(client_id: Uuid) -> Option<GameState> {
    let cont = STATE.read().unwrap();
    return states::select_state(&cont, client_id).map(|s| s.clone());
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

fn remove_player(conn_id: Uuid, state: &mut GameState) {
    world::remove_player_from_state(conn_id, state);
}

pub fn get_prng() -> SmallRng {
    let mut rng = thread_rng();
    let prng = SmallRng::seed_from_u64(rng.next_u64());
    return prng;
}

pub fn seed_prng(seed: String) -> SmallRng {
    return SmallRng::seed_from_u64(system_gen::str_to_hash(seed));
}

pub fn prng_id(rng: &mut SmallRng) -> Uuid {
    let mut bytes = [0u8; 16];
    rng.fill_bytes(&mut bytes);

    crate::Builder::from_bytes(bytes)
        .set_variant(Variant::RFC4122)
        .set_version(Version::Random)
        .build()
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
    make_thread("watch_replay_folder")
        .spawn(|| replays_api::watch_replay_folder())
        .ok();

    sandbox::init_saved_states();
    rocket::ignite()
        .attach(CORS())
        .mount(
            "/api",
            routes![api::get_version, api::get_health, api::head_health],
        )
        .mount(
            "/api/sandbox",
            routes![
                sandbox_api::get_saved_states,
                sandbox_api::save_current_state,
                sandbox_api::load_saved_state,
                sandbox_api::load_random_state,
                sandbox_api::load_seeded_state,
                sandbox_api::save_state_into_json,
                sandbox_api::load_clean_state,
            ],
        )
        .mount(
            "/api/replays",
            routes![
                replays_api::get_saved_replays,
                replays_api::get_replay_by_id,
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

fn broadcast_state_thread() {
    loop {
        let diff = {
            let start = Local::now();
            for guard in ROOMS_READ.iter() {
                main_ws_server::x_cast_state(
                    guard.val().state.clone(),
                    XCast::Broadcast(guard.val().state.id.clone()),
                );
            }
            (Local::now() - start).num_milliseconds()
        };
        // log!(format!("broadcast duration={}ms", diff));
        thread::sleep(Duration::from_millis(
            (BROADCAST_SLEEP_MS as i64 - diff).max(0) as u64,
        ));
    }
}

fn make_thread(name: &str) -> std::thread::Builder {
    std::thread::Builder::new().name(name.to_string())
}

const PERF_CONSUME_TIME: i64 = 15 * 1000 * 1000;
const EVENT_TRIGGER_TIME: i64 = 500 * 1000;
const FRAME_BUDGET_TICKS: i32 = 15 * 1000;
const FRAME_STATS_COUNT: i32 = 2000;

lazy_static! {
    pub static ref SUB_RE: Regex = Regex::new(r"s_\w+").unwrap();
}

fn main_thread() {
    let mut prng = get_prng();
    let d_table = *DIALOGUE_TABLE.lock().unwrap().clone();
    let mut last = Local::now();
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
            if *DEBUG_FRAME_STATS {
                log!(format!(
                    "Frame stats: shortcut {:.2}%, over-budget {:.2}% for {}",
                    shortcut_pct, over_budget_pct, frame_count
                ));
            }
            frame_count = 0;
            over_budget_frame = 0;
            shortcut_frame = 0;
        }
        sampler.init_budget(FRAME_BUDGET_TICKS);
        let total_mark = sampler.start(SamplerMarks::MainTotal as u32);
        let locks_id = sampler.start(SamplerMarks::Locks as u32);
        let mut cont = STATE.write().unwrap();
        let mut d_states = DIALOGUE_STATES.lock().unwrap();
        if sampler.end_top(locks_id) < 0 {
            shortcut_frame += 1;
            sampler.end(total_mark);
            continue;
        }

        let now = Local::now();
        let elapsed = now - last;
        last = now;
        let elapsed_micro = elapsed.num_milliseconds() * 1000;

        let update_rooms_id = sampler.start(SamplerMarks::Update as u32);
        cleanup_empty_rooms(&mut cont);
        let mut updated_rooms = vec![];
        let mut spatial_indexes_by_room_id = HashMap::new();
        for room in get_rooms_iter(&cont) {
            let (spatial_indexes, room_clone, new_sampler) =
                world::update_room(&mut prng, sampler, elapsed_micro, &room, &d_table);
            sampler = new_sampler;
            updated_rooms.push(room_clone);
            spatial_indexes_by_room_id.insert(room.id, spatial_indexes);
        }

        update_rooms(&mut cont, updated_rooms);
        if sampler.end_top(update_rooms_id) < 0 {
            shortcut_frame += 1;
            sampler.end(total_mark);
            continue;
        }

        {
            if bot_action_elapsed > BOT_ACTION_TIME_TICKS {
                let bots_mark = sampler.start(SamplerMarks::Bots as u32);
                let bot_players_mark = sampler.start(SamplerMarks::BotsPlayers as u32);
                for room in cont.rooms.values.iter_mut() {
                    let spatial_indexes = spatial_indexes_by_room_id.get(&room.id).unwrap();
                    do_bot_players_actions(
                        room,
                        &mut **d_states,
                        &d_table,
                        bot_action_elapsed,
                        spatial_indexes,
                        &mut prng,
                    );
                }
                sampler.end(bot_players_mark);
                let npcs_mark = sampler.start(SamplerMarks::BotsNPCs as u32);
                for room in cont.rooms.values.iter_mut() {
                    let spatial_indexes = spatial_indexes_by_room_id.get(&room.id).unwrap();
                    do_bot_npcs_actions(room, bot_action_elapsed, spatial_indexes, &mut prng);
                }
                sampler.end(npcs_mark);
                if sampler.end_top(bots_mark) < 0 {
                    shortcut_frame += 1;
                    sampler.end(total_mark);
                    continue;
                }
                bot_action_elapsed = 0;
            } else {
                bot_action_elapsed += elapsed_micro;
            }
        }

        if events_elapsed > EVENT_TRIGGER_TIME {
            let events_mark = sampler.start(SamplerMarks::Events as u32);
            let receiver = &mut server_events::EVENTS.1.lock().unwrap();
            let res = server_events::handle_events(receiver, &mut cont);
            for (client_id, dialogue) in res {
                let corresponding_state_id = get_state_id_cont_mut(&mut cont, client_id);
                corresponding_state_id.map(|corresponding_state_id| {
                    main_ws_server::unicast_dialogue_state(
                        client_id,
                        dialogue,
                        corresponding_state_id,
                    )
                });
            }
            if sampler.end_top(events_mark) < 0 {
                shortcut_frame += 1;
                sampler.end(total_mark);
                continue;
            }
            events_elapsed = 0;
        } else {
            events_elapsed += elapsed_micro;
        }

        let cleanup_mark = sampler.start(SamplerMarks::ShipCleanup as u32);
        for room in cont.rooms.values.iter_mut() {
            let bot_ids = HashSet::from_iter(room.bots.iter().map(|b| b.id));
            cleanup_orphaned_players(&mut room.state, &bot_ids);
            let existing_player_ships = room
                .state
                .players
                .iter()
                .map(|p| p.ship_id.clone())
                .filter(|s| s.is_some())
                .map(|s| s.unwrap())
                .collect::<Vec<_>>();

            let len = room.state.locations.len();
            for idx in 0..len {
                cleanup_orphaned_ships(&mut room.state, &existing_player_ships, idx);
            }
        }

        if sampler.end_top(cleanup_mark) < 0 {
            shortcut_frame += 1;
            sampler.end(total_mark);
            continue;
        }

        sampler.end(total_mark);

        sampler_consume_elapsed += elapsed_micro;
        if sampler_consume_elapsed > PERF_CONSUME_TIME {
            sampler_consume_elapsed = 0;
            let (sampler_out, metrics) = sampler.consume();
            sampler = sampler_out;
            if *ENABLE_PERF {
                log!(format!(
                    "performance stats over {} sec \n{}",
                    PERF_CONSUME_TIME / 1000 / 1000,
                    metrics.join("\n")
                ));
            }
        }

        if sampler.budget <= 0 {
            over_budget_frame += 1;
            log!(format!("Frame over budget by {}µs", -sampler.budget));
        }

        let sleep_remaining = sampler.budget.max(0);
        sampler.try_finalize_budget();

        if sleep_remaining > MIN_SLEEP_TICKS {
            thread::sleep(Duration::from_micros(sleep_remaining as u64));
        }
    }
}

fn broadcast_all_states(cont: &mut RwLockReadGuard<StateContainer>) {
    for room in get_rooms_iter_read(cont) {
        main_ws_server::x_cast_state(room.state.clone(), XCast::Broadcast(room.state.id));
    }
}

fn broadcast_all_states_rooms(rooms: Vec<Room>) {
    for room in rooms.into_iter() {
        let state_id = room.state.id;
        main_ws_server::x_cast_state(room.state, XCast::Broadcast(state_id));
    }
}

pub fn cleanup_orphaned_ships(
    state: &mut GameState,
    existing_player_ships: &Vec<Uuid>,
    location_idx: usize,
) {
    let new_ships = state.locations[location_idx]
        .ships
        .clone()
        .into_iter()
        .filter(|s| existing_player_ships.contains(&s.id) || s.npc.is_some())
        .collect::<Vec<_>>();
    state.locations[location_idx].ships = new_ships;
}

pub fn cleanup_orphaned_players(state: &mut GameState, bot_ids: &HashSet<Uuid>) {
    let mut to_drop = HashSet::new();
    for player in state.players.iter() {
        if !bot_ids.contains(&player.id) && main_ws_server::is_disconnected(player.id) {
            to_drop.insert(player.id);
        }
    }
    if to_drop.len() > 0 {
        log!(format!("will drop orphaned players {:?}", to_drop));
    }
    state.players.retain(|p| !to_drop.contains(&p.id));
}

pub fn fire_event(ev: GameEvent) {
    server_events::fire_event(ev);
}
