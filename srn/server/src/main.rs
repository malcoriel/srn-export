#![feature(exclusive_range_pattern)]
#![allow(dead_code)]
#![allow(unused_imports)]
#[macro_use]
extern crate serde_derive;

use std::collections::HashMap;
use std::collections::HashSet;
use std::iter::FromIterator;
use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex, MutexGuard, RwLock, RwLockWriteGuard};
use std::thread;
use std::time::Duration;

use chrono::{DateTime, Local, Utc};
use crossbeam::channel::{bounded, Receiver, Sender};
use itertools::Itertools;
use lazy_static::lazy_static;
use num_traits::FromPrimitive;
use regex::Regex;
use rocket::{Request, Response};
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::Header;
use rocket::http::Method;
use rocket_contrib::json::Json;
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;
use serde_derive::{Deserialize, Serialize};
use uuid::*;
use websocket::{Message, OwnedMessage};
use websocket::client::sync::Writer;
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;

use dialogue::{DialogueStates, DialogueTable};
use dialogue_dto::Dialogue;
use net::{ClientErr, ClientOpCode, PersonalizeUpdate, ServerToClientMessage, ShipsWrapper, SwitchRoomPayload, TagConfirm, Wrapper};
use world::{GameMode, GameState, Player, Ship};
use xcast::XCast;

use crate::bots::{bot_init, do_bot_actions};
use crate::chat::chat_server;
use crate::dialogue::{
    DialogueId, DialogueScript, DialogueUpdate, execute_dialog_option,
};
use crate::perf::Sampler;
use crate::sandbox::mutate_state;
use crate::system_gen::make_tutorial_state;
use crate::vec2::Vec2f64;
use crate::world::{AABB, find_my_player, find_my_player_mut, find_my_ship, find_planet, GameEvent, ShipAction, spawn_ship, update_quests, UpdateOptions, find_and_extract_ship};

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

mod bots;
mod xcast;
mod dialogue;
mod dialogue_test;
mod events;
pub mod perf;
mod planet_movement;
mod random_stuff;
mod system_gen;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
pub mod world;
mod world_test;
mod chat;
mod inventory;
mod inventory_test;
mod net;
mod sandbox;
mod market;
mod api;
mod dialogue_dto;
mod planet_movement_test;
mod locations;
mod long_actions;

pub struct StateContainer {
    personal_states: HashMap<Uuid, GameState>,
    state: GameState,
}

struct LastCheck {
    time: DateTime<Utc>,
}

type WSRequest =
WsUpgrade<std::net::TcpStream, std::option::Option<websocket::server::upgrade::sync::Buffer>>;

lazy_static! {
    pub static ref DISPATCHER: (Arc<Mutex<Sender<ServerToClientMessage>>>, Arc<Mutex<Receiver<ServerToClientMessage>>>) =
    {
        let (sender, receiver) = bounded::<ServerToClientMessage>(128);
        (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
    };
}

lazy_static! {
    static ref DIALOGUE_STATES: Arc<Mutex<Box<DialogueStates>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

lazy_static! {
    static ref CLIENT_SENDERS: Arc<Mutex<Vec<(Uuid, Sender<ServerToClientMessage>)>>> =
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
        let mut state = world::seed_state(true, true);
        state.mode = world::GameMode::CargoRush;
        let states = HashMap::new();
        RwLock::new(StateContainer { personal_states: states, state })
    };
}

pub const ENABLE_PERF: bool = false;
const DEFAULT_SLEEP_MS: u64 = 1;
const MAX_ERRORS: u32 = 10;
const MAX_ERRORS_SAMPLE_INTERVAL: i64 = 5000;
const DEBUG_PHYSICS: bool = false;
const MAIN_THREAD_SLEEP_MS: u64 = 15;

fn mutate_owned_ship_wrapped(client_id: Uuid, mutate_cmd: ShipAction, tag: Option<String>) {
    let res = mutate_owned_ship(client_id, mutate_cmd, tag);
    if res.is_none() {
        warn!("error mutating owned ship");
        increment_client_errors(client_id);
        disconnect_if_bad(client_id);
    }
}

fn move_player_to_personal_room(client_id: Uuid, mode: GameMode) {
    let mut cont = STATE.write().unwrap();
    let player_idx = cont.state.players.iter().position(|p| p.id == client_id).unwrap();
    {
        find_and_extract_ship(&mut cont.state, client_id);
    }
    let player = cont.state.players.remove(player_idx);
    let player_clone = player.clone();
    let personal_state = cont.personal_states.entry(client_id).or_insert(system_gen::seed_personal_state(client_id, &mode));
    personal_state.players.push(player);

    {
        spawn_ship(personal_state, client_id, None);
    }
    // the state id filtering will take care of filtering the receivers
    let state = personal_state.clone();
    let state_id = state.id.clone();
    x_cast_state(state, XCast::Broadcast(state_id));
    notify_state_changed(personal_state.id, client_id);
    fire_event(GameEvent::RoomJoined { personal: true, mode, player: player_clone });
}

fn mutate_owned_ship(
    client_id: Uuid,
    mutate_cmd: ShipAction,
    tag: Option<String>,
) -> Option<Ship> {
    let mut cont = STATE.write().unwrap();
    let mut state = {
        if cont.personal_states.contains_key(&client_id) {
            cont.personal_states.get_mut(&client_id).unwrap()
        } else {
            &mut cont.state
        }
    };
    if let Some(tag) = tag {
        send_tag_confirm(tag, client_id);
    }
    let mutated = world::mutate_ship_no_lock(client_id, mutate_cmd, &mut state);
    if let Some(mutated) = mutated {
        crate::multicast_ships_update_excluding(state.locations[mutated.1.location_idx as usize].ships.clone(), Some(client_id), state.id);
        return Some(mutated.0);
    }
    return None;
}

fn x_cast_state(state: GameState, x_cast: XCast) {
    DISPATCHER.0.lock().unwrap()
        .send(ServerToClientMessage::XCastStateChange(state, x_cast))
        .unwrap();
}

fn notify_state_changed(state_id: Uuid, target_client_id: Uuid) {
    DISPATCHER.0.lock().unwrap()
        .send(ServerToClientMessage::RoomSwitched(XCast::Unicast(state_id, target_client_id)))
        .unwrap();
}

fn unicast_dialogue_state(client_id: Uuid, dialogue_state: Option<Dialogue>, current_state_id: Uuid) {
    DISPATCHER.0.lock().unwrap()
        .send(ServerToClientMessage::DialogueStateChange(
            Wrapper::new(dialogue_state),
            client_id,
            current_state_id,
        ))
        .unwrap();
}

fn dispatch(message: ServerToClientMessage) {
    DISPATCHER.0.lock().unwrap().send(message).unwrap();
}

fn multicast_ships_update_excluding(ships: Vec<Ship>, client_id: Option<Uuid>, current_state_id: Uuid) {
    DISPATCHER.0.lock().unwrap()
        .send(ServerToClientMessage::MulticastPartialShipUpdate(
            ShipsWrapper { ships },
            client_id,
            current_state_id,
        ))
        .unwrap();
}

fn send_tag_confirm(tag: String, client_id: Uuid) {
    DISPATCHER.0.lock().unwrap()
        .send(ServerToClientMessage::TagConfirm(
            TagConfirm { tag },
            client_id,
        ))
        .unwrap();
}

fn websocket_server() {
    let addr = "0.0.0.0:2794";
    let server = Server::bind(addr).unwrap();
    println!("WS server has launched on {}", addr);

    for request in server.filter_map(Result::ok) {
        thread::spawn(|| handle_request(request));
    }
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
        state = net::patch_state_for_client_impl(state, client_id);
        let message: Message = Message::text(serde_json::to_string(&state).unwrap());
        client.send_message(&message).unwrap();
    }

    let (public_client_sender, public_client_receiver) = bounded::<ServerToClientMessage>(128);
    CLIENT_SENDERS.lock().unwrap().push((client_id, public_client_sender));

    let (mut socket_receiver, mut socket_sender) = client.split().unwrap();
    let (inner_client_sender, inner_incoming_client_receiver) = bounded::<OwnedMessage>(128);

    // Whenever we get something from socket, we have to put it to inner queue
    // It seems that recv_message is blocking, so it has to be in a separate thread
    // to not block the main client thread. Frankly, I copied this code but it indeed did not
    // work otherwise
    thread::spawn(move || loop {
        if is_disconnected(client_id) {
            break;
        }

        let message = socket_receiver.recv_message();
        match message {
            Ok(m) => {
                inner_client_sender.send(m).ok();
            }
            Err(e) => {
                eprintln!("err {} receiving ws {}", client_id, e);
                increment_client_errors(client_id);
                disconnect_if_bad(client_id);
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

        // whenever we get something from inner queue (means from socket), we have to trigger
        // some logic
        if let Ok(message) = inner_incoming_client_receiver.try_recv() {
            match message {
                OwnedMessage::Close(_) => {
                    on_client_close(ip, client_id, &mut socket_sender);
                    return;
                }
                OwnedMessage::Ping(msg) => {
                    let message = Message::pong(msg);
                    socket_sender.send_message(&message).unwrap();
                }
                OwnedMessage::Text(msg) => {
                    on_client_text_message(client_id, msg)
                }
                _ => {}
            }
        }
        // whenever some other function sends a message, we have to put it to socket
        if let Ok(message) = public_client_receiver.try_recv() {
            on_message_to_send_to_client(client_id, &mut socket_sender, &message)
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    }
}

fn on_message_to_send_to_client(client_id: Uuid, sender: &mut Writer<TcpStream>, message: &ServerToClientMessage) {
    if is_disconnected(client_id) {
        return;
    }
    let current_state_id = get_state_id(client_id);
    let should_send: bool = xcast::check_message_casting(client_id, &message, current_state_id);
    if should_send {
        let message = Message::text(message.clone().patch_for_client(client_id).serialize());
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

fn get_state_id(client_id: Uuid) -> Uuid {
    let cont = STATE.read().unwrap();
    let in_personal = cont.personal_states.contains_key(&client_id);
    let current_state_id = if !in_personal { cont.state.id } else {
        client_id
    };
    current_state_id
}

fn on_client_text_message(client_id: Uuid, msg: String) {
    let parts = msg.split("_%_").collect::<Vec<&str>>();
    if parts.len() < 2 || parts.len() > 3 {
        eprintln!("Corrupt message (not 2-3 parts) {}", msg);
        return;
    }
    let first = parts.iter().nth(0).unwrap();
    let second = parts.iter().nth(1).unwrap();
    let third = parts.iter().nth(2);

    let parse_opcode = first.parse::<u32>();
    if parse_opcode.is_err() {
        eprintln!("Invalid opcode {} {:?}", first, parse_opcode.err());
        return;
    }
    let number = parse_opcode.ok().unwrap();

    let op_code = FromPrimitive::from_u32(number);
    if op_code.is_none() {
        eprintln!("Unknown opcode {}", number);
        return;
    }
    let op_code = op_code.unwrap();
    match op_code {
        ClientOpCode::Sync => {
            on_client_sync_request(client_id, second, third)
        }
        ClientOpCode::MutateMyShip => {
            on_client_mutate_ship(client_id, second, third)
        }
        ClientOpCode::Name => {
            on_client_personalize(client_id, second)
        }
        ClientOpCode::DialogueOption => {
            on_client_dialogue(client_id, second, third);
        }
        ClientOpCode::SwitchRoom => {
            on_client_switch_room(client_id, second)
        }
        ClientOpCode::SandboxCommand => {
            on_client_sandbox_command(client_id, second, third);
        }
        ClientOpCode::TradeAction => {
            on_client_trade_action(client_id, second, third);
        }
        ClientOpCode::Unknown => {}
        ClientOpCode::DialogueRequest => {
            on_client_dialogue_request(client_id, second, third);
        }
        ClientOpCode::InventoryAction => {
            on_client_inventory_action(client_id, second, third);
        }
        ClientOpCode::LongActionStart => {
            on_client_long_action_start(client_id, second, third);
        }
    };
}

fn on_client_long_action_start(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<long_actions::LongActionStart>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = select_mut_state(&mut cont, client_id);
            let action_dbg = action.clone();
            if !long_actions::try_start_long_action(state, client_id, action) {
                warn!(format!("Impossible long action for client {}, action {:?}", client_id, action_dbg));
            }
            x_cast_state(state.clone(), XCast::Unicast(state.id, client_id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!(
                "couldn't parse long action start {}, err {}",
                data, err
            );
        }
    }
}

fn on_client_switch_room(client_id: Uuid, second: &&str) {
    let parsed =
        serde_json::from_str::<SwitchRoomPayload>(second);
    match parsed {
        Ok(parsed) => {
            move_player_to_personal_room(client_id, parsed.mode);
        }
        Err(err) => {
            warn!(format!("Bad switch room, err is {}", err));
        }
    }
}

fn on_client_dialogue(client_id: Uuid, second: &&str, third: Option<&&str>) {
    handle_dialogue_option(
        client_id,
        serde_json::from_str::<DialogueUpdate>(second)
            .ok()
            .unwrap(),
        third.map(|s| s.to_string()),
    );
}

fn on_client_personalize(client_id: Uuid, second: &&str) {
    let parsed =
        serde_json::from_str::<PersonalizeUpdate>(second);
    match parsed {
        Ok(up) => {
            personalize_player(client_id, up);
        }
        Err(_) => {}
    }
}

fn on_client_mutate_ship(client_id: Uuid, second: &&str, third: Option<&&str>) {
    let parsed = serde_json::from_str::<ShipAction>(second);
    match parsed {
        Ok(res) => mutate_owned_ship_wrapped(
            client_id,
            res,
            third.map(|s| s.to_string()),
        ),
        Err(err) => {
            eprintln!(
                "couldn't parse ship action {}, err {}",
                second, err
            );
        }
    }
}

fn on_client_sandbox_command(client_id: Uuid, second: &&str, third: Option<&&str>) {
    let parsed = serde_json::from_str::<sandbox::SandboxCommand>(second);
    match parsed {
        Ok(res) => {
            let mut cont = STATE.write().unwrap();
            let personal_state = select_mut_state(&mut cont, client_id);
            if personal_state.mode != world::GameMode::Sandbox {
                warn!(format!("Attempt to send a sandbox command to non-sandbox state by client {}", client_id));
                return;
            }
            sandbox::mutate_state(
                personal_state,
                client_id,
                res,
            );
            send_tag_confirm(third.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!(
                "couldn't parse sandbox action {}, err {}",
                second, err
            );
        }
    }
}

fn on_client_trade_action(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<market::TradeAction>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = select_mut_state(&mut cont, client_id);
            market::attempt_trade(
                state,
                client_id,
                action,
            );
            x_cast_state(state.clone(), XCast::Broadcast(state.id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!(
                "couldn't parse trade action {}, err {}",
                data, err
            );
        }
    }
}

fn on_client_inventory_action(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<inventory::InventoryAction>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = select_mut_state(&mut cont, client_id);
            if let Some(ship) = world::find_my_ship_mut(state, client_id) {
                inventory::apply_action(
                    &mut ship.inventory,
                    action,
                );
            }
            x_cast_state(state.clone(), XCast::Unicast(state.id, client_id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!(
                "couldn't parse trade action {}, err {}",
                data, err
            );
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueRequest {
    planet_id: Uuid,
}

fn on_client_dialogue_request(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<DialogueRequest>(data);
    match parsed {
        // Technically, the dialogue should be triggered with the planet specified.
        // However, the basic_planet trigger will handle the 'current' planet
        // by itself. This will be useful later, however, to trigger something like
        // remote-to-planet dialogue
        Ok(_action) => {
            let mut cont = STATE.write().unwrap();
            let state = select_mut_state(&mut cont, client_id);
            if let Some(player) = find_my_player(state, client_id) {
                fire_event(GameEvent::DialogueTriggerRequest {
                    dialogue_name: "basic_planet".to_string(),
                    player: player.clone(),
                })
            }
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!(
                "couldn't parse dialogue request {}, err {}",
                data, err
            );
        }
    }
}

fn on_client_sync_request(client_id: Uuid, second: &&str, third: Option<&&str>) {
    if third.is_some() {
        thread::sleep(Duration::from_millis(
            third.unwrap().parse::<u64>().unwrap(),
        ))
    }
    let mut state = get_state_clone_read(client_id);
    state.tag = Some(second.to_string());
    let current_state_id = get_state_id(client_id);
    x_cast_state(state, XCast::Unicast(current_state_id, client_id))
}

fn on_client_close(ip: SocketAddr, client_id: Uuid, sender: &mut Writer<TcpStream>) {
    let message = Message::close();
    sender.send_message(&message).ok();
    let mut senders = CLIENT_SENDERS.lock().unwrap();
    let index = senders.iter().position(|s| s.0 == client_id);
    index.map(|index| senders.remove(index));
    remove_player(client_id);
    println!("Client {} id {} disconnected", ip, client_id);
    let state = STATE.read().unwrap().state.clone();
    let state_id = state.id.clone();
    x_cast_state(state, XCast::Broadcast(state_id));
}

fn get_state_clone_read(client_id: Uuid) -> GameState {
    let cont = STATE.read().unwrap();
    return cont.personal_states.get(&client_id).unwrap_or(&cont.state).clone();
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
        let state = STATE.read().unwrap().state.clone();
        let state_id = state.id.clone();
        x_cast_state(state, XCast::Broadcast(state_id));
    }
}

fn handle_dialogue_option(client_id: Uuid, dialogue_update: DialogueUpdate, _tag: Option<String>) {
    let global_state_change;
    {
        let mut cont = STATE.write().unwrap();
        let mut dialogue_cont = DIALOGUE_STATES.lock().unwrap();
        let dialogue_table = DIALOGUE_TABLE.lock().unwrap();
        let mut_state = select_mut_state(&mut cont, client_id);
        world::force_update_to_now(mut_state);
        let (new_dialogue_state, state_changed) = execute_dialog_option(
            client_id,
            mut_state,
            dialogue_update,
            &mut *dialogue_cont,
            &*dialogue_table,
        );
        unicast_dialogue_state(client_id.clone(), new_dialogue_state, mut_state.id);
        global_state_change = state_changed;
    }
    {
        if global_state_change {
            let state = get_state_clone_read(client_id);
            let state_id = state.id.clone();
            x_cast_state(state, XCast::Broadcast(state_id));
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
        (ship, cont.state.locations[0].planets.clone())
    };
    {
        let mut cont = STATE.write().unwrap();
        let mut player = find_my_player_mut(&mut cont.state, conn_id).unwrap();
        player.quest = world::generate_random_quest(&planets, ship.docked_at);
    }
}

fn remove_player(conn_id: Uuid) {
    let mut cont = STATE.write().unwrap();
    let in_personal = cont.personal_states.contains_key(&conn_id);
    let state = if in_personal { cont.personal_states.get_mut(&conn_id).unwrap() } else { &mut cont.state };
    world::remove_player_from_state(conn_id, state);
    cont.personal_states.remove(&conn_id);
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
        response.set_header(Header::new("Access-Control-Allow-Methods", "POST, GET, PATCH, OPTIONS"));
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

    std::thread::spawn(|| {
        websocket_server();
    });

    std::thread::spawn(|| {
        chat_server();
    });


    std::thread::spawn(|| {
        main_thread();
    });

    thread::spawn(move || { dispatcher_thread() });

    thread::spawn(|| cleanup_thread());

    sandbox::init_saved_states();
    rocket::ignite()
        .attach(CORS())
        .mount("/api", routes![
        api::get_version,
        api::get_health,
        api::get_saved_states,
        api::save_current_state,
        api::load_saved_state,
        api::load_random_state,
        api::load_seeded_state,
        api::save_state_into_json,
        api::load_clean_state
        ])
}

fn dispatcher_thread() {
    // due to some magic, cloning the Arc-Mutex gives me a permanent link to
    // the non-cloned contents
    let client_senders = CLIENT_SENDERS.clone();
    let unwrapped = DISPATCHER.1.lock().unwrap();
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
            "Personal states",            // 20
            "Update market",              // 21
            "Update tick long actions"    // 22
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
                limit_area: AABB::maxed(),
            });
        sampler = updated_sampler;

        sampler.end(update_id);
        cont.state = updated_state;

        let personal_id = sampler.start(20);
        cont.personal_states = HashMap::from_iter(cont.personal_states.iter().filter_map(|(_, state)| {
            if state.players.len() == 0 {
                return None;
            }
            let (new_state, _) = world::update_world(state.clone(), elapsed_micro, false, Sampler::empty(), UpdateOptions {
                disable_hp_effects: false,
                limit_area: AABB::maxed(),
            });
            Some((new_state.id, new_state))
        }));
        sampler.end(personal_id);

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
            let receiver = &mut events::EVENTS.1.lock().unwrap();
            let res =
                events::handle_events(&mut d_table, receiver, &mut cont, d_states);
            for (client_id, dialogue) in res {
                let corresponding_state_id = if cont.personal_states.contains_key(&client_id) { client_id } else { cont.state.id };
                unicast_dialogue_state(client_id, dialogue, corresponding_state_id);
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

        for idx in 0..cont.state.locations.len() {
            sampler = cleanup_nonexistent_ships(&mut cont, &existing_player_ships, idx, sampler);
        }
        sampler.end(cleanup_mark);

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

pub fn cleanup_nonexistent_ships(cont: &mut RwLockWriteGuard<StateContainer>, existing_player_ships: &Vec<Uuid>, location_idx: usize, mut sampler: Sampler) -> Sampler {
    let new_ships = cont
        .state.locations[location_idx]
        .ships
        .clone()
        .into_iter()
        .filter(|s| existing_player_ships.contains(&s.id))
        .collect::<Vec<_>>();
    let old_ships_len = cont.state.locations[location_idx].ships.len();
    let new_ships_len = new_ships.len();
    cont.state.locations[location_idx].ships = new_ships;

    if new_ships_len != old_ships_len {
        sampler.measure(
            &|| multicast_ships_update_excluding(cont.state.locations[location_idx].ships.clone(), None, cont.state.id),
            7,
        );
    }
    sampler
}

pub fn send_event_to_client(ev: GameEvent, x_cast: XCast) {
    let sender = DISPATCHER.0.lock().unwrap();
    sender
        .send(ServerToClientMessage::XCastGameEvent(
            Wrapper::new(ev),
            x_cast,
        ))
        .unwrap();
}

pub fn fire_event(ev: GameEvent) {
    events::fire_event(ev);
}

pub fn kick_player(player_id: Uuid) {
    dispatch(ServerToClientMessage::RoomLeave(player_id));
}

pub fn select_mut_state<'a, 'b, 'c>(cont: &'a mut RwLockWriteGuard<StateContainer>,
                                    player_id: Uuid) -> &'a mut GameState {
    if cont.personal_states.contains_key(&player_id) {
        cont.personal_states.get_mut(&player_id).unwrap()
    } else { &mut cont.state }
}
