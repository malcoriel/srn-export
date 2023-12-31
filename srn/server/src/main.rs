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

use chrono::{DateTime, Local, Timelike, Utc};
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
use dialogue::{Dialogue, DialogueStates, DialogueTable};
use lockfree::map::Map as LockFreeMap;
use lockfree::set::Set as LockFreeSet;
use mut_static::MutStatic;
use net::{
    ClientErr, ClientOpCode, PersonalizeUpdate, ServerToClientMessage, ShipsWrapper,
    SwitchRoomPayload, TagConfirm, Wrapper,
};
use perf::SamplerMarks;
use rand::{thread_rng, RngCore, SeedableRng};
use rand_pcg::Pcg64Mcg;
use states::{get_rooms_iter, update_rooms, StateContainer, ROOMS_READ, STATE};
use world::{GameMode, GameState, Player, Ship, SpatialIndexes};
use world_events::GameEvent;
use xcast::XCast;

use crate::api_struct::{PerfStats, Room};
use crate::autofocus::build_spatial_index;
use crate::bots::{do_bot_npcs_actions, do_bot_players_actions};
use crate::chat::chat_server;
use crate::dialogue::{execute_dialog_option, DialogueId, DialogueScript, DialogueUpdate};
use crate::indexing::{
    find_and_extract_ship, find_my_player, find_my_player_mut, find_my_ship, find_planet,
};
use crate::net::{patch_diffs_for_client_impl, patch_state_for_all_clients, XCastStateDiff};
use crate::perf::{ConsumeOptions, Sampler};
use crate::replay::ReplayDiffed;
use crate::rooms_api::{cleanup_empty_rooms, find_room_state_id_by_player_id, reindex_rooms};
use crate::sandbox::mutate_state;
use crate::states::{
    get_rooms_iter_mut, get_rooms_iter_read, get_state_id_cont, get_state_id_cont_mut,
    select_state, select_state_mut,
};
use crate::substitutions::substitute_notification_texts;
use crate::vec2::Vec2f64;
use crate::world::{spawn_ship, update_rule_specifics, UpdateOptions, AABB};
use world_actions::Action;

#[allow(unused_macros)]
macro_rules! log {
    ($($t:tt)*) => {
        (println!("log: {}", ($($t)*).to_string()))
    }
}

#[allow(unused_macros)]
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

#[allow(unused_macros)]
macro_rules! log2 {
    ($($arg:tt)*) => {
        println!("log: {}", format_args!($($arg)*));
    }
}

#[allow(unused_macros)]
macro_rules! warn2 {
    ($($arg:tt)*) => {
        println!("warn: {}", format_args!($($arg)*));
    }
}

#[allow(unused_macros)]
macro_rules! err2 {
    ($($arg:tt)*) => {
        println!("err: {}", format_args!($($arg)*));
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
mod macros;

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
mod effects;
mod fof;
mod hp;
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
mod properties;
mod random_stuff;
mod replay;
mod replays_api;
mod resources;
mod resources_api;
mod rooms_api;
mod sandbox;
mod sandbox_api;
mod self_inspect;
mod server_events;
mod spatial_movement;
mod states;
mod substitutions;
mod system_gen;
mod tid;
mod tractoring;
mod trajectory;
mod tutorial;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
pub mod world;
mod world_actions;
mod world_events;
mod xcast;

use properties::*;

struct LastCheck {
    time: DateTime<Utc>,
}

pub type WSRequest =
    WsUpgrade<std::net::TcpStream, std::option::Option<websocket::server::upgrade::sync::Buffer>>;

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

const DEFAULT_SLEEP_MS: u64 = 1;
const FULL_BROADCAST_EVERY_TICKS: i64 = 100 * 1000;
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

pub fn get_now_nano() -> u64 {
    let now = chrono::Local::now();
    now.second() as u64 * 1_000_000_000 + now.nanosecond() as u64
}

pub fn get_prng() -> Pcg64Mcg {
    let mut rng = thread_rng();
    let prng = Pcg64Mcg::seed_from_u64(rng.next_u64());
    return prng;
}

pub fn seed_prng(seed: String) -> Pcg64Mcg {
    return Pcg64Mcg::seed_from_u64(system_gen::str_to_hash(seed));
}

pub fn prng_id(rng: &mut Pcg64Mcg) -> Uuid {
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
    ctrlc::set_handler(move || {
        println!("\nReceived Ctrl+C, terminating process...");
        std::process::exit(0);
    })
    .expect("Error setting Ctrl-C handler");

    self_inspect::declare();
    {
        let mut d_table = DIALOGUE_TABLE.lock().unwrap();
        let scripts: Vec<DialogueScript> = dialogue::gen_scripts();
        for script in scripts {
            d_table.scripts.insert(script.id, script);
        }
    }

    make_thread("ws_s")
        .spawn(|| {
            main_ws_server::websocket_server();
        })
        .ok();

    make_thread("ch_s")
        .spawn(|| {
            chat_server();
        })
        .ok();

    make_thread("main")
        .spawn(|| {
            main_thread();
        })
        .ok();

    make_thread("disp")
        .spawn(move || main_ws_server::dispatcher_thread())
        .ok();

    make_thread("ws_clean")
        .spawn(|| main_ws_server::cleanup_bad_clients_thread())
        .ok();
    make_thread("watch_repl")
        .spawn(|| replays_api::watch_replay_folder())
        .ok();

    sandbox::init_saved_states();
    rocket::ignite()
        .attach(CORS())
        .mount(
            "/api",
            routes![
                api::get_version,
                api::get_health,
                api::head_health,
                api::get_perf
            ],
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
        .mount(
            "/api/resources",
            routes![resources_api::get_dialogue_scripts],
        )
}

fn make_thread(name: &str) -> std::thread::Builder {
    // thread name includes srn-server for easier filtering in htop
    std::thread::Builder::new().name(format!("{}-srn", name.to_string()))
}

const PERF_CONSUME_TIME: i64 = 15 * 1000 * 1000;
const EVENT_TRIGGER_TIME: i64 = 500 * 1000;
const FRAME_BUDGET_TICKS: i32 = 15 * 1000;
// const FRAME_STATS_COUNT: i32 = 2000;

lazy_static! {
    pub static ref SUB_RE: Regex = Regex::new(r"s_\w+").unwrap();
}

lazy_static! {
    pub static ref FRAME_STATS: MutStatic<PerfStats> = MutStatic::from(PerfStats {
        shortcut_pct: 0.0,
        over_budget_pct: 0.0,
        frame_count: 0,
    });
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
    sampler
        .ignore_warning_for_marks
        .insert(SamplerMarks::MainTotal as u32);
    sampler
        .ignore_warning_for_marks
        .insert(SamplerMarks::Update as u32);
    sampler
        .ignore_warning_for_marks
        .insert(SamplerMarks::FrameBudgetTicks as u32);
    let mut sampler_consume_elapsed = 0;
    let mut events_elapsed = 0;
    let mut full_broadcast_elapsed: i64 = 0;
    let mut frame_count = 0;
    let mut over_budget_frame = 0;
    let mut shortcut_frame = 0;

    loop {
        let now = Local::now();
        let elapsed = now - last;
        // log!(format!("iter {}", now));
        last = now;
        let elapsed_micro = elapsed.num_milliseconds() * 1000;
        sampler_consume_elapsed += elapsed_micro;
        if sampler_consume_elapsed > PERF_CONSUME_TIME {
            let over_budget_pct = over_budget_frame as f32 / frame_count as f32 * 100.0;
            let shortcut_pct = shortcut_frame as f32 / frame_count as f32 * 100.0;
            {
                let mut stats = FRAME_STATS.write().unwrap();
                stats.shortcut_pct = shortcut_pct;
                stats.over_budget_pct = over_budget_pct;
                stats.frame_count = frame_count;
            }
            if *DEBUG_FRAME_STATS {
                log!(format!(
                    "Frame stats: shortcut {:.2}%, over-budget {:.2}% for {}",
                    shortcut_pct, over_budget_pct, frame_count
                ));
            }
            frame_count = 0;
            over_budget_frame = 0;
            shortcut_frame = 0;
            sampler_consume_elapsed = 0;
            let (sampler_out, metrics) = sampler.consume(ConsumeOptions {
                max_mean_ticks: 1000,
                max_delta_ticks: 1000,
                max_max: 1000,
            });
            sampler = sampler_out;
            if *ENABLE_PERF {
                log!("------");
                log!(format!(
                    "performance stats over {} sec \n{}",
                    PERF_CONSUME_TIME / 1000 / 1000,
                    metrics
                        .into_iter()
                        .map(|(line, has_warning)| if !has_warning {
                            line
                        } else {
                            console::style(line).yellow().to_string()
                        })
                        .join("\n")
                ));
                log!("------");
            }
        }
        frame_count += 1;
        sampler.init_budget(FRAME_BUDGET_TICKS);
        let total_mark = sampler.start(SamplerMarks::MainTotal as u32);
        let locks_id = sampler.start(SamplerMarks::Locks as u32);
        let mut cont = STATE.write().unwrap();
        if sampler.end_top(locks_id) < 0 {
            shortcut_frame += 1;
            sampler.end(total_mark);
            continue;
        }

        // For now it seems that due to WS being full-duplex, sending state also clogs client sending commands,
        // therefore not going to send it every update. Should be solved when I split sending and receiving channels
        if full_broadcast_elapsed > FULL_BROADCAST_EVERY_TICKS {
            let broadcast_mark = sampler.start(SamplerMarks::BroadcastState as u32);
            // broadcast first, then update, to ensure that broadcast always happens even if update is shortcut
            for room in get_rooms_iter_mut(&mut cont) {
                let state_id = room.state.id.clone();
                let mut cloned = room.state.clone();
                patch_state_for_all_clients(&mut cloned);
                // double-cloning because the message is sent to the channel, and reference is not an option for now (I don't know how to work with Rcs)
                main_ws_server::x_cast_state(cloned.clone(), XCast::Broadcast(state_id));
            }
            sampler.end(broadcast_mark);
            full_broadcast_elapsed = 0;
        } else {
            full_broadcast_elapsed += elapsed_micro;
        }

        let update_rooms_id = sampler.start(SamplerMarks::Update as u32);
        cleanup_empty_rooms(&mut cont);
        let mut spatial_indexes_by_room_id = HashMap::new();
        for room in get_rooms_iter_mut(&mut cont) {
            let (spatial_indexes, new_sampler) =
                world::update_room(&mut prng, sampler, elapsed_micro, room, &d_table, None);
            sampler = new_sampler;
            spatial_indexes_by_room_id.insert(room.id, spatial_indexes);
        }
        reindex_rooms(&mut cont.rooms);
        if sampler.end_top(update_rooms_id) < 0 {
            shortcut_frame += 1;
            sampler.end(total_mark);
            continue;
        }

        if events_elapsed > EVENT_TRIGGER_TIME {
            let event_locks_mark = sampler.start(SamplerMarks::EventsLocks as u32);
            let receiver = &mut server_events::EVENTS.1.lock().unwrap();
            if sampler.end_top(event_locks_mark) < 0 {
                shortcut_frame += 1;
                sampler.end(total_mark);
                continue;
            }
            let events_mark = sampler.start(SamplerMarks::Events as u32);
            let sampler_new = server_events::handle_events(receiver, &mut cont, sampler);
            sampler = sampler_new;
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

        if sampler.budget < 0 {
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

pub fn cleanup_orphaned_ships(
    state: &mut GameState,
    existing_player_ships: &Vec<Uuid>,
    location_idx: usize,
) {
    for ship in state.locations[location_idx].ships.iter_mut() {
        if existing_player_ships.contains(&ship.id) || ship.npc.is_some() {
            continue;
        }
        ship.to_clean = true;
    }
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
