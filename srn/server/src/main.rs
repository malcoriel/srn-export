#![allow(dead_code)]
#![allow(unused_imports)]
#[macro_use]
extern crate serde_derive;

use std::collections::HashMap;
use std::collections::HashSet;
use std::iter::FromIterator;
use std::sync::{Arc, mpsc, Mutex, RwLock, RwLockWriteGuard};
use std::thread;
use std::time::Duration;

use chrono::{DateTime, Local, Utc};
use crossbeam::channel::{bounded, Receiver, Sender};
use itertools::Itertools;
use lazy_static::lazy_static;
use num_traits::FromPrimitive;
use pkg_version::*;
use regex::Regex;
use rocket::http::Method;
use rocket_contrib::json::Json;
use rocket_cors::{AllowedHeaders, AllowedOrigins};
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;
use serde_derive::{Deserialize, Serialize};
use uuid::*;
use websocket::{Message, OwnedMessage};
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;

use dialogue::{DialogueStates, DialogueTable};
use net::{ClientErr, ClientOpCode, PersonalizeUpdate, ServerToClientMessage, ShipsWrapper, SwitchRoomPayload, TagConfirm, Wrapper};
use world::{GameState, Player, Ship};
use xcast::XCast;

use crate::bots::{bot_init, do_bot_actions};
use crate::chat::chat_server;
use crate::dialogue::{
    Dialogue, DialogueId, DialogueScript, DialogueUpdate, execute_dialog_option,
};
use crate::perf::Sampler;
use crate::system_gen::make_tutorial_state;
use crate::vec2::Vec2f64;
use crate::world::{AABB, find_my_player, find_my_player_mut, find_my_ship, find_planet, GameEvent, remove_player_ship, ShipAction, spawn_ship, update_quests, UpdateOptions};

const MAJOR: u32 = pkg_version_major!();
const MINOR: u32 = pkg_version_minor!();
const PATCH: u32 = pkg_version_patch!();

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
extern crate rocket_cors;
extern crate websocket;
#[macro_use]
extern crate num_derive;
mod bots;
mod xcast;
mod dialogue;
mod dialogue_test;
mod events;
mod perf;
mod planet_movement;
mod random_stuff;
mod system_gen;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
mod world;
mod world_test;
mod chat;
mod inventory;
mod inventory_test;
mod net;

pub struct StateContainer {
    tutorial_states: HashMap<Uuid, GameState>,
    state: GameState,
}

struct LastCheck {
    time: DateTime<Utc>,
}
type WSRequest =
    WsUpgrade<std::net::TcpStream, std::option::Option<websocket::server::upgrade::sync::Buffer>>;

static mut DISPATCHER_SENDER: Option<Mutex<std::sync::mpsc::Sender<ServerToClientMessage>>> = None;
static mut DISPATCHER_RECEIVER: Option<Mutex<std::sync::mpsc::Receiver<ServerToClientMessage>>> =
    None;

lazy_static! {
    static ref DIALOGUE_STATES: Arc<Mutex<Box<DialogueStates>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

lazy_static! {
    static ref CLIENT_SENDERS: Arc<Mutex<Vec<(Uuid, std::sync::mpsc::Sender<ServerToClientMessage>)>>> =
        Arc::new(Mutex::new(vec![]));
}

lazy_static! {
    static ref CLIENT_ERRORS_LAST_CHECK: Arc<Mutex<LastCheck>> =
        Arc::new(Mutex::new(LastCheck { time: Utc::now() }));
}

lazy_static! {
    static ref CLIENT_ERRORS: Arc<Mutex<HashMap<Uuid, u32>>> = Arc::new(Mutex::new(HashMap::new()));
}

lazy_static! {
    static ref DIALOGUE_TABLE: Arc<Mutex<Box<DialogueTable>>> =
        Arc::new(Mutex::new(Box::new(DialogueTable::new())));
}

lazy_static! {
    static ref STATE: RwLock<StateContainer> = {
        let state = world::seed_state(true, true);
        let states = HashMap::new();
        RwLock::new(StateContainer { tutorial_states: states, state })
    };
}

#[get("/version")]
fn get_version() -> Json<String> {
    let version = format!("{}.{}.{}", MAJOR, MINOR, PATCH);
    Json(version)
}

lazy_static! {
    static ref EVENTS: (Arc<Mutex<Sender<GameEvent>>>, Arc<Mutex<Receiver<GameEvent>>>) =
    {
        let (sender, receiver) = bounded::<GameEvent>(128);
        (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
    };
}

pub const ENABLE_PERF: bool = true;
const DEFAULT_SLEEP_MS: u64 = 1;
const MAX_ERRORS: u32 = 10;
const MAX_ERRORS_SAMPLE_INTERVAL: i64 = 5000;
const DEBUG_PHYSICS: bool = false;
const MAIN_THREAD_SLEEP_MS: u64 = 15;

fn mutate_owned_ship_wrapped(client_id: Uuid, mutate_cmd: ShipAction, tag: Option<String>, in_tutorial: bool) {
    let res = mutate_owned_ship(client_id, mutate_cmd, tag, in_tutorial);
    if res.is_err() {
        eprintln!("error mutating owned ship {}", res.err().unwrap().message);
        increment_client_errors(client_id);
        disconnect_if_bad(client_id);
    }
}

fn move_player_to_tutorial_room(client_id: Uuid) {
    let mut cont = STATE.write().unwrap();
    let player_idx = cont.state.players.iter().position(|p| p.id == client_id).unwrap();
    {
        remove_player_ship(&mut cont.state, client_id);
    }
    let player = cont.state.players.remove(player_idx);
    let player_clone = player.clone();
    let personal_state = cont.tutorial_states.entry(client_id).or_insert(make_tutorial_state(client_id));
    personal_state.players.push(player);

    {
        spawn_ship(personal_state, client_id, None);
    }
    // the state id filtering will take care of filtering the receivers
    broadcast_state(personal_state.clone());
    notify_state_changed(personal_state.id, client_id);
    fire_event(GameEvent::RoomJoined { in_tutorial: true, player: player_clone });
}

fn mutate_owned_ship(
    client_id: Uuid,
    mutate_cmd: ShipAction,
    tag: Option<String>,
    in_tutorial: bool,
) -> Result<Ship, ClientErr> {
    let mut cont = STATE.write().unwrap();
    let mut state = if in_tutorial {
        cont.tutorial_states.get_mut(&client_id).unwrap()
    } else {
        &mut cont.state
    };
    mutate_ship_no_lock(client_id, mutate_cmd, tag, &mut state)
}

fn mutate_ship_no_lock(
    client_id: Uuid,
    mutate_cmd: ShipAction,
    tag: Option<String>,
    state: &mut GameState,
) -> Result<Ship, ClientErr> {
    let old_ship_index = world::find_my_ship_index(&state, client_id);
    if old_ship_index.is_none() {
        return Err(ClientErr {
            message: String::from("No old instance of ship"),
        });
    }
    world::force_update_to_now(state);
    let updated_ship = world::apply_ship_action(mutate_cmd, &state, client_id);
    if let Some(updated_ship) = updated_ship {
        let replaced = try_replace_ship(state, &updated_ship, client_id);
        if replaced {
            multicast_ships_update_excluding(state.ships.clone(), Some(client_id), state.id);
            if let Some(tag) = tag {
                send_tag_confirm(tag, client_id);
            }
            return Ok(updated_ship);
        }
        return Err(ClientErr {
            message: String::from("Couldn't replace ship"),
        });
    }
    world::force_update_to_now(state);
    return Err(ClientErr {
        message: String::from("Ship update was invalid"),
    });
}

fn try_replace_ship(state: &mut GameState, updated_ship: &Ship, player_id: Uuid) -> bool {
    let old_ship_index = world::find_my_ship_index(&state, player_id);
    return if let Some(old_ship_index) = old_ship_index {
        state.ships.remove(old_ship_index);
        state.ships.push(updated_ship.clone());
        true
    } else {
        eprintln!("couldn't replace ship");
        false
    };
}

fn broadcast_state(state: GameState) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::StateChange(state))
            .unwrap();
    }
}

fn notify_state_changed(state_id: Uuid, target_client_id: Uuid) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::RoomSwitched(XCast::Unicast(state_id, target_client_id)))
            .unwrap();
    }
}

fn unicast_dialogue_state(client_id: Uuid, dialogue_state: Option<Dialogue>, current_state_id: Uuid) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::DialogueStateChange(
                Wrapper::new(dialogue_state),
                client_id,
                current_state_id
            ))
            .unwrap();
    }
}

fn multicast_ships_update_excluding(ships: Vec<Ship>, client_id: Option<Uuid>, current_state_id: Uuid) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::MulticastPartialShipUpdate(
                ShipsWrapper { ships },
                client_id,
                current_state_id
            ))
            .unwrap();
    }
}

fn send_tag_confirm(tag: String, client_id: Uuid) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::TagConfirm(
                TagConfirm { tag },
                client_id,
            ))
            .unwrap();
    }
}

unsafe fn get_dispatcher_sender() -> std::sync::mpsc::Sender<ServerToClientMessage> {
    DISPATCHER_SENDER.as_ref().unwrap().lock().unwrap().clone()
}

fn websocket_server() {
    let addr = "0.0.0.0:2794";
    let server = Server::bind(addr).unwrap();
    println!("WS server has launched on {}", addr);

    for request in server.filter_map(Result::ok) {
        thread::spawn(|| handle_request(request));
    }
}

fn patch_state_for_player(mut state: GameState, player_id: Uuid) -> GameState {
    state.my_id = player_id;
    state
}

fn handle_request(request: WSRequest) {
    if !request.protocols().contains(&"rust-websocket".to_string()) {
        request.reject().unwrap();
        return;
    }

    let mut client = request.use_protocol("rust-websocket").accept().unwrap();

    let ip = client.peer_addr().unwrap();

    let client_id = Uuid::new_v4();
    println!("Connection from {}, id={}", ip, client_id);

    make_new_human_player(client_id);

    {
        let mut state = STATE.read().unwrap().state.clone();
        state = patch_state_for_player(state, client_id);
        let message: Message = Message::text(serde_json::to_string(&state).unwrap());
        client.send_message(&message).unwrap();
    }

    let (client_tx, client_rx) = mpsc::channel::<ServerToClientMessage>();
    CLIENT_SENDERS.lock().unwrap().push((client_id, client_tx));

    let (mut receiver, mut sender) = client.split().unwrap();
    let (message_tx, message_rx) = mpsc::channel::<OwnedMessage>();
    thread::spawn(move || loop {
        if is_disconnected(client_id) {
            break;
        }

        let message = receiver.recv_message();
        match message {
            Ok(m) => {
                message_tx.send(m).ok();
            }
            Err(e) => {
                eprintln!("err {} receiving ws {}", client_id, e);
                increment_client_errors(client_id);
            }
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    });

    loop {
        if is_disconnected(client_id) {
            break;
        }
        if disconnect_if_bad(client_id) {
            break;
        }

        let (current_state_id, in_tutorial) = {
            let cont = STATE.read().unwrap();
            let in_tutorial = cont.tutorial_states.contains_key(&client_id);

            eprintln!("in tut {}", in_tutorial);
            let current_state_id = if !in_tutorial { cont.state.id } else {
                // tutorial states are personal, and have the same id as player
                client_id
            };
            (current_state_id, in_tutorial)
        };



        if let Ok(message) = message_rx.try_recv() {
            match message {
                OwnedMessage::Close(_) => {
                    let message = Message::close();
                    sender.send_message(&message).ok();
                    let mut senders = CLIENT_SENDERS.lock().unwrap();
                    let index = senders.iter().position(|s| s.0 == client_id);
                    index.map(|index| senders.remove(index));
                    remove_player(client_id);
                    println!("Client {} id {} disconnected", ip, client_id);
                    broadcast_state(STATE.read().unwrap().state.clone());
                    return;
                }
                OwnedMessage::Ping(msg) => {
                    let message = Message::pong(msg);
                    sender.send_message(&message).unwrap();
                }
                OwnedMessage::Text(msg) => {
                    let parts = msg.split("_%_").collect::<Vec<&str>>();
                    if parts.len() < 2 || parts.len() > 3 {
                        eprintln!("Corrupt message (not 2-3 parts) {}", msg);
                    } else {
                        let first = parts.iter().nth(0).unwrap();
                        let second = parts.iter().nth(1).unwrap();
                        let third = parts.iter().nth(2);

                        match first.parse::<u32>() {
                            Ok(number) => match FromPrimitive::from_u32(number) {
                                Some(op_code) => match op_code {
                                    ClientOpCode::Sync => {
                                        if third.is_some() {
                                            thread::sleep(Duration::from_millis(
                                                third.unwrap().parse::<u64>().unwrap(),
                                            ))
                                        }
                                        let mut state = get_state_clone_read(in_tutorial, client_id);
                                        state.tag = Some(second.to_string());
                                        broadcast_state(state)
                                    }
                                    ClientOpCode::MutateMyShip => {
                                        let parsed = serde_json::from_str::<ShipAction>(second);
                                        match parsed {
                                            Ok(res) => mutate_owned_ship_wrapped(
                                                client_id,
                                                res,
                                                third.map(|s| s.to_string()),
                                                in_tutorial
                                            ),
                                            Err(err) => {
                                                eprintln!(
                                                    "couldn't parse ship action {}, err {}",
                                                    second, err
                                                );
                                            }
                                        }
                                    }
                                    ClientOpCode::Name => {
                                        let parsed =
                                            serde_json::from_str::<PersonalizeUpdate>(second);
                                        match parsed {
                                            Ok(up) => {
                                                personalize_player(client_id, up);
                                            }
                                            Err(_) => {}
                                        }
                                    }
                                    ClientOpCode::DialogueOption => {
                                        handle_dialogue_option(
                                            client_id,
                                            serde_json::from_str::<DialogueUpdate>(second)
                                                .ok()
                                                .unwrap(),
                                            third.map(|s| s.to_string()),
                                            current_state_id,
                                            in_tutorial
                                        );
                                    }
                                    ClientOpCode::SwitchRoom => {
                                        let parsed =
                                            serde_json::from_str::<SwitchRoomPayload>(second);
                                        match parsed {
                                            Ok(parsed) => {
                                                if parsed.tutorial {
                                                    move_player_to_tutorial_room(client_id);
                                                }
                                            }
                                            Err(err) => {
                                                warn!(format!("Bad switch room, err is {}", err));
                                            }
                                        }
                                    }
                                    ClientOpCode::Unknown => {}

                                },
                                None => {}
                            },
                            Err(e) => {
                                eprintln!("Invalid opcode {} {}", first, e);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        if let Ok(message) = client_rx.try_recv() {
            if !is_disconnected(client_id) {
                let should_send: bool = xcast::check_message_casting(client_id, &message, current_state_id);
                let patched_message: ServerToClientMessage = match message.clone() {
                    ServerToClientMessage::StateChangeExclusive(state, id) => {
                        ServerToClientMessage::StateChangeExclusive(
                            patch_state_for_player(state, client_id),
                            id,
                        )
                    }
                    ServerToClientMessage::StateChange(state) => {
                        ServerToClientMessage::StateChange(patch_state_for_player(state, client_id))
                    }
                    m => m,
                };
                if should_send {
                    let message = Message::text(patched_message.serialize());
                    sender
                        .send_message(&message)
                        .map_err(|e| {
                            eprintln!("Err {} sending {}", client_id, e);
                            increment_client_errors(client_id);
                            disconnect_if_bad(client_id);
                        })
                        .ok();
                }
            }
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    }
}

fn get_state_clone_read(is_tutorial: bool, client_id: Uuid) -> GameState {
    if !is_tutorial {
        STATE.read().unwrap().state.clone()
    } else {
        STATE.read().unwrap().tutorial_states.get(&client_id).unwrap().clone()
    }
}

fn force_disconnect_client(client_id: Uuid) {
    let mut senders = CLIENT_SENDERS.lock().unwrap();
    let bad_sender_index = senders.iter().position(|c| c.0 == client_id);
    if let Some(index) = bad_sender_index {
        eprintln!("force disconnecting client: {}", client_id);
        senders.remove(index);
    }
    remove_player(client_id);
}

fn disconnect_if_bad(client_id: Uuid) -> bool {
    let mut errors = CLIENT_ERRORS.lock().unwrap();
    let mut last_check = CLIENT_ERRORS_LAST_CHECK.lock().unwrap();
    let now = Utc::now();
    let diff = (last_check.time - now).num_milliseconds().abs();
    if diff > MAX_ERRORS_SAMPLE_INTERVAL {
        if errors.values().any(|e| *e > 0) {
            eprintln!("Resetting errors, old {:?}", errors);
        }
        last_check.time = now;
        *errors = HashMap::new();
    }
    let entry = errors.entry(client_id).or_insert(0);
    if *entry > MAX_ERRORS {
        force_disconnect_client(client_id);
        return true;
    }
    return false;
}

fn increment_client_errors(client_id: Uuid) {
    let mut errors = CLIENT_ERRORS.lock().unwrap();
    let entry = errors.entry(client_id).or_insert(0);
    *entry += 1;
}

fn is_disconnected(client_id: Uuid) -> bool {
    let senders = CLIENT_SENDERS.lock().unwrap();
    let index = senders.iter().position(|s| s.0 == client_id);
    if index.is_none() {
        // client disconnected
        return true;
    }
    return false;
}

fn personalize_player(conn_id: Uuid, update: PersonalizeUpdate) {
    {
        let mut cont = STATE.write().unwrap();
        world::force_update_to_now(&mut cont.state);
        cont.state
            .players
            .iter_mut()
            .find(|p| p.id == conn_id)
            .map(|p| {
                p.name = update.name;
                p.portrait_name = update.portrait_name;
            });
    }
    {
        broadcast_state(STATE.read().unwrap().state.clone());
    }
}

fn handle_dialogue_option(client_id: Uuid, dialogue_update: DialogueUpdate, _tag: Option<String>, current_state_id: Uuid, in_tutorial: bool) {
    let global_state_change;
    {
        let mut cont = STATE.write().unwrap();
        let mut dialogue_cont = DIALOGUE_STATES.lock().unwrap();
        let dialogue_table = DIALOGUE_TABLE.lock().unwrap();
        world::force_update_to_now(if in_tutorial {cont.tutorial_states.get_mut(&client_id).unwrap()} else { &mut cont.state });
        let (new_dialogue_state, state_changed) = execute_dialog_option(
            client_id,
            if in_tutorial {cont.tutorial_states.get_mut(&client_id).unwrap()} else { &mut cont.state },
            dialogue_update,
            &mut *dialogue_cont,
            &*dialogue_table,
        );
        unicast_dialogue_state(client_id.clone(), new_dialogue_state, current_state_id);
        global_state_change = state_changed;
    }
    {
        if global_state_change {
            broadcast_state(get_state_clone_read(in_tutorial, client_id));
        }
    }
}

fn make_new_human_player(conn_id: Uuid) {
    {
        let mut cont = STATE.write().unwrap();
        world::add_player(&mut cont.state, conn_id, false, None);
    }
    let (ship, planets) = {
        let mut cont = STATE.write().unwrap();
        let ship = world::spawn_ship(&mut cont.state, conn_id, None).clone();
        (ship, cont.state.planets.clone())
    };
    {
        let mut cont = STATE.write().unwrap();
        let mut player = find_my_player_mut(&mut cont.state, conn_id).unwrap();
        player.quest = world::generate_random_quest(&planets, ship.docked_at);
    }
}

fn remove_player(conn_id: Uuid) {
    let mut cont = STATE.write().unwrap();
    let in_tutorial = cont.tutorial_states.contains_key(&conn_id);
    let state = if in_tutorial {cont.tutorial_states.get_mut(&conn_id).unwrap()} else { &mut cont.state};
    world::remove_player_from_state(conn_id, state);
    cont.tutorial_states.remove(&conn_id);
}

pub fn new_id() -> Uuid {
    Uuid::new_v4()
}

#[launch]
fn rocket() -> rocket::Rocket {
    unsafe {
        let (tx, rx) = std::sync::mpsc::channel::<ServerToClientMessage>();
        DISPATCHER_SENDER = Some(Mutex::new(tx));
        DISPATCHER_RECEIVER = Some(Mutex::new(rx));
    }

    {
        let mut d_table = DIALOGUE_TABLE.lock().unwrap();
        let scripts: Vec<DialogueScript> = dialogue::gen_scripts();
        for script in scripts {
            d_table.scripts.insert(script.id, script);
        }
    }

    std::thread::spawn(|| {
        websocket_server();
    });

    std::thread::spawn(|| {
        chat_server();
    });


    std::thread::spawn(|| {
        main_thread();
    });

    let client_senders = CLIENT_SENDERS.clone();
    thread::spawn(move || unsafe { dispatcher_thread(client_senders) });

    thread::spawn(|| cleanup_thread());

    let cors = rocket_cors::CorsOptions {
        allowed_origins: AllowedOrigins::some_exact(&[
            "http://localhost:3000",
            "https://srn.malcoriel.de",
        ]),
        allowed_methods: vec![Method::Get, Method::Post, Method::Options]
            .into_iter()
            .map(From::from)
            .collect(),
        allowed_headers: AllowedHeaders::some(&[
            "Authorization",
            "Accept",
            "Content-Type",
            "Content-Length",
        ]),

        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .unwrap();

    rocket::ignite()
        .attach(cors)
        .mount("/api", routes![get_version]) // post_state
}

unsafe fn dispatcher_thread(
    client_senders: Arc<Mutex<Vec<(Uuid, std::sync::mpsc::Sender<ServerToClientMessage>)>>>,
) {
    let unwrapped = DISPATCHER_RECEIVER.as_mut().unwrap().lock().unwrap();
    while let Ok(msg) = unwrapped.recv() {
        for sender in client_senders.lock().unwrap().iter() {
            let send = sender.1.send(msg.clone());
            if let Err(e) = send {
                eprintln!("err {} sending {}", sender.0, e);
                increment_client_errors(sender.0);
                disconnect_if_bad(sender.0);
            }
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS))
    }
    thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS))
}

fn cleanup_thread() {
    loop {
        let client_errors = CLIENT_ERRORS.lock().unwrap();
        let clients = client_errors
            .clone()
            .keys()
            .map(|k| k.clone())
            .collect::<Vec<_>>();
        std::mem::drop(client_errors);
        for client_id in clients {
            disconnect_if_bad(client_id);
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    }
}

const PERF_CONSUME_TIME: i64 = 30 * 1000 * 1000;
const BOT_ACTION_TIME: i64 = 200 * 1000;
const EVENT_TRIGGER_TIME: i64 = 500 * 1000;

lazy_static! {
    pub static ref SUB_RE: Regex = Regex::new(r"s_\w+").unwrap();
}

fn main_thread() {
    let mut d_table = *DIALOGUE_TABLE.lock().unwrap().clone();
    let mut last = Local::now();
    {
        let mut bots = bots::BOTS.lock().unwrap();
        bot_init(&mut *bots);
    }
    let mut sampler = Sampler::new(
        vec![
            "Main total",                 // 0
            "Update",                     // 1
            "Locks",                      // 2
            "Quests",                     // 3
            "Bots",                       // 4
            "Events",                     // 5
            "Ship cleanup",               // 6
            "Multicast update",           // 7
            "Update leaderboard",         // 8
            "Update planet movement",     // 9
            "Update asteroids",           // 10
            "Update ships on planets",    // 11
            "Update ships navigation",    // 12
            "Update ships tractoring",    // 13
            "Update tractored materials", // 14
            "Update ship hp effects",     // 15
            "Update minerals respawn",    // 16
            "Update ships respawn",       // 17
            "Update planets 1",           // 18
            "Update planets 2",           // 19
            "Tutorial states",           // 20
            "Tutorial events",           // 21
        ]
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>(),
    );
    let mut sampler_consume_elapsed = 0;
    let mut bot_action_elapsed = 0;
    let mut events_elapsed = 0;
    loop {
        thread::sleep(Duration::from_millis(MAIN_THREAD_SLEEP_MS));

        let total_mark = sampler.start(0);
        let mut cont = STATE.write().unwrap();
        let mut d_states = DIALOGUE_STATES.lock().unwrap();
        let mut bots = bots::BOTS.lock().unwrap();

        let now = Local::now();
        let elapsed = now - last;
        last = now;
        let elapsed_micro = elapsed.num_milliseconds() * 1000;
        let update_id = sampler.start(1);
        let (updated_state, updated_sampler) =
            world::update_world(cont.state.clone(), elapsed_micro, false, sampler, UpdateOptions {
                disable_hp_effects: false,
                limit_area: AABB::maxed()
            });
        sampler = updated_sampler;

        sampler.end(update_id);
        cont.state = updated_state;

        let tutorial_id = sampler.start(20);
        cont.tutorial_states = HashMap::from_iter(cont.tutorial_states.iter().filter_map(|(_, state)| {
            if state.players.len() == 0 {
                return None;
            }
            let (new_state, _) = world::update_world(state.clone(), elapsed_micro, false, Sampler::empty(), UpdateOptions {
                disable_hp_effects: false,
                limit_area: AABB::maxed()
            });
            Some((new_state.id, new_state))
        }));
        sampler.end(tutorial_id);

        let quests_mark = sampler.start(3);
        update_quests(&mut cont.state);
        sampler.end(quests_mark);

        let d_states = &mut **d_states;
        let state = &mut cont.state;

        if bot_action_elapsed > BOT_ACTION_TIME {
            let bots_mark = sampler.start(4);
            let bots = &mut *bots;
            do_bot_actions(state, bots, d_states, &d_table, bot_action_elapsed);
            sampler.end(bots_mark);
            bot_action_elapsed = 0;
        } else {
            bot_action_elapsed += elapsed_micro;
        }

        if events_elapsed > EVENT_TRIGGER_TIME {
            let events_mark = sampler.start(5);
            let receiver = &mut EVENTS.1.lock().unwrap();
            let (res, updated_sampler) =
                events::handle_events(&mut d_table, receiver, &mut cont, d_states, sampler);
            sampler = updated_sampler;
            for (client_id, dialogue) in res {
                unicast_dialogue_state(client_id, dialogue, cont.state.id);
            }
            sampler.end(events_mark);
            events_elapsed = 0;
        } else {
            events_elapsed += elapsed_micro;
        }

        let cleanup_mark = sampler.start(6);
        let existing_player_ships = cont
            .state
            .players
            .iter()
            .map(|p| p.ship_id.clone())
            .filter(|s| s.is_some())
            .map(|s| s.unwrap())
            .collect::<Vec<_>>();
        cont.state.ships = cont
            .state
            .ships
            .clone()
            .into_iter()
            .filter(|s| existing_player_ships.contains(&s.id))
            .collect::<Vec<_>>();
        sampler.end(cleanup_mark);

        sampler.measure(
            &|| multicast_ships_update_excluding(cont.state.ships.clone(), None, cont.state.id),
            7,
        );

        sampler.end(total_mark);

        sampler_consume_elapsed += elapsed_micro;
        if sampler_consume_elapsed > PERF_CONSUME_TIME && ENABLE_PERF {
            sampler_consume_elapsed = 0;
            let (sampler_out, metrics) = sampler.consume();
            sampler = sampler_out;
            log!(format!(
                "performance stats over {} sec \n{}",
                PERF_CONSUME_TIME / 1000 / 1000,
                metrics.join("\n")
            ));
        }
    }
}

pub fn send_event_to_client(ev: GameEvent, x_cast: XCast) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::XCastGameEvent(
                Wrapper::new(ev),
                x_cast,
            ))
            .unwrap();
    }
}

pub fn fire_event(ev: GameEvent) {
    events::fire_event(ev);
}
