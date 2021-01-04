#![allow(dead_code)]
#![allow(unused_imports)]
#[macro_use]
extern crate serde_derive;

use chrono::{DateTime, Local, Utc};
use dialogue::{DialogueStates, DialogueTable};
use lazy_static::lazy_static;
use mpsc::{channel, Receiver, Sender};
use num_traits::FromPrimitive;
use rocket::http::Method;
use rocket_contrib::json::Json;
use rocket_cors::{AllowedHeaders, AllowedOrigins};
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;
use uuid::*;
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;
use websocket::{Message, OwnedMessage};

use world::{GameState, Player, Ship};

#[macro_use]
extern crate rocket;
extern crate rocket_cors;
extern crate websocket;
#[macro_use]
extern crate num_derive;

mod bots;
mod dialogue;
mod random_stuff;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
mod world;
mod world_test;

lazy_static! {
    static ref CLIENT_SENDERS: Arc<Mutex<Vec<(Uuid, Sender<ServerToClientMessage>)>>> =
        Arc::new(Mutex::new(vec![]));
}

struct LastCheck {
    time: DateTime<Utc>,
}

lazy_static! {
    static ref CLIENT_ERRORS_LAST_CHECK: Arc<Mutex<LastCheck>> =
        Arc::new(Mutex::new(LastCheck { time: Utc::now() }));
}

lazy_static! {
    static ref CLIENT_ERRORS: Arc<Mutex<HashMap<Uuid, u32>>> = Arc::new(Mutex::new(HashMap::new()));
}
#[derive(Deserialize, Serialize, Debug, Clone)]
struct TagConfirm {
    tag: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct ShipsWrapper {
    ships: Vec<Ship>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct Wrapper<T> {
    value: T,
}

impl<T> Wrapper<T> {
    pub fn new(value: T) -> Self {
        Wrapper { value }
    }
}

#[derive(Debug, Clone)]
enum ServerToClientMessage {
    StateChange(GameState),
    StateChangeExclusive(GameState, Uuid),
    TagConfirm(TagConfirm, Uuid),
    MulticastPartialShipUpdate(ShipsWrapper, Uuid),
    DialogueStateChange(Wrapper<Option<Dialogue>>, Uuid),
}

impl ServerToClientMessage {
    pub fn serialize(&self) -> String {
        let (code, serialized) = match self {
            ServerToClientMessage::StateChange(state) => {
                (1, serde_json::to_string::<GameState>(&state).unwrap())
            }
            ServerToClientMessage::StateChangeExclusive(state, _unused) => {
                (2, serde_json::to_string::<GameState>(&state).unwrap())
            }
            ServerToClientMessage::TagConfirm(tag_confirm, _unused) => (
                3,
                serde_json::to_string::<TagConfirm>(&tag_confirm).unwrap(),
            ),
            ServerToClientMessage::MulticastPartialShipUpdate(ships, _unused) => {
                (4, serde_json::to_string::<ShipsWrapper>(ships).unwrap())
            }
            ServerToClientMessage::DialogueStateChange(dialogue, _unused) => (
                5,
                serde_json::to_string::<Wrapper<Option<Dialogue>>>(dialogue).unwrap(),
            ),
        };
        format!("{}_%_{}", code, serialized)
    }
}

static mut DISPATCHER_SENDER: Option<Mutex<Sender<ServerToClientMessage>>> = None;
static mut DISPATCHER_RECEIVER: Option<Mutex<Receiver<ServerToClientMessage>>> = None;

struct StateContainer {
    state: GameState,
}

lazy_static! {
    static ref STATE: RwLock<StateContainer> = {
        let state = world::seed_state(true);
        RwLock::new(StateContainer { state })
    };
}

#[get("/state")]
fn get_state() -> Json<GameState> {
    Json(STATE.read().unwrap().state.clone())
}

#[options("/state")]
fn options_state() {}

// #[post("/state", data = "<state>")]
// fn post_state(state: Json<GameState>) {
//     mutate_state(state.into_inner());
// }
//
// fn mutate_state(state: GameState) {
//     let mut mut_state = STATE.write().unwrap();
//     mut_state.ships = state.ships.clone();
//     mut_state.tick = mut_state.tick + 1;
//     broadcast_state(mut_state.clone());
// }

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ClientErr {
    message: String,
}

fn mutate_owned_ship_wrapped(client_id: Uuid, new_ship: Ship, tag: Option<String>) {
    let res = mutate_owned_ship(client_id, new_ship, tag);
    if res.is_err() {
        eprintln!("error mutating owned ship {}", res.err().unwrap().message);
        increment_client_errors(client_id);
        disconnect_if_bad(client_id);
    }
}

fn mutate_owned_ship(
    client_id: Uuid,
    new_ship: Ship,
    tag: Option<String>,
) -> Result<Ship, ClientErr> {
    let updated_ship: Ship;
    let old_ship_index;
    let mut cont = STATE.write().unwrap();
    let state_clone = cont.state.clone();

    let player = state_clone.players.iter().find(|p| p.id == client_id);
    match player {
        None => {
            return Err(ClientErr {
                message: String::from("No player found"),
            })
        }
        Some(player) => {
            if player.ship_id.is_some() {
                if new_ship.id != player.ship_id.unwrap() {
                    return Err(ClientErr {
                        message: String::from(format!("Wrong ship id {}", new_ship.id)),
                    });
                }
            } else {
                return Err(ClientErr {
                    message: String::from("No current ship"),
                });
            }
        }
    }
    let old_ship = state_clone
        .ships
        .iter()
        .position(|s| s.id == player.unwrap().ship_id.unwrap());
    if old_ship.is_none() {
        return Err(ClientErr {
            message: String::from("No old instance of ship"),
        });
    }
    old_ship_index = old_ship.clone();
    let old_ship = state_clone.ships[old_ship.unwrap()].clone();
    let ok = validate_ship_move(&old_ship, &new_ship);
    if !ok {
        updated_ship = old_ship;
    } else {
        updated_ship = new_ship;
    }
    cont.state.ships.remove(old_ship_index.unwrap());
    world::force_update_to_now(&mut cont.state);
    cont.state.ships.push(updated_ship.clone());
    multicast_ships_update_excluding(cont.state.ships.clone(), client_id);
    if let Some(tag) = tag {
        send_tag_confirm(tag, client_id);
    }
    return Ok(updated_ship);
}

fn validate_ship_move(_old: &Ship, _new: &Ship) -> bool {
    // some anti-cheat needed
    return true;
}

fn broadcast_state(state: GameState) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::StateChange(state))
            .unwrap();
    }
}

fn unicast_dialogue_state(client_id: Uuid, dialogue_state: Option<Dialogue>) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::DialogueStateChange(
                Wrapper::new(dialogue_state),
                client_id,
            ))
            .unwrap();
    }
}

fn multicast_ships_update_excluding(ships: Vec<Ship>, client_id: Uuid) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ServerToClientMessage::MulticastPartialShipUpdate(
                ShipsWrapper { ships },
                client_id,
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

unsafe fn get_dispatcher_sender() -> Sender<ServerToClientMessage> {
    DISPATCHER_SENDER.as_ref().unwrap().lock().unwrap().clone()
}

#[derive(FromPrimitive, ToPrimitive, Debug, Clone)]
enum ClientOpCode {
    Unknown = 0,
    Sync = 1,
    MutateMyShip = 2,
    Name = 3,
    DialogueOption = 4,
}

type WSRequest =
    WsUpgrade<std::net::TcpStream, std::option::Option<websocket::server::upgrade::sync::Buffer>>;

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

const DEFAULT_SLEEP_MS: u64 = 1;

fn handle_request(request: WSRequest) {
    if !request.protocols().contains(&"rust-websocket".to_string()) {
        request.reject().unwrap();
        return;
    }

    let mut client = request.use_protocol("rust-websocket").accept().unwrap();

    let ip = client.peer_addr().unwrap();

    let client_id = Uuid::new_v4();
    println!("Connection from {}, id={}", ip, client_id);

    make_new_human_player(&client_id);
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

        if let Ok(message) = message_rx.try_recv() {
            match message {
                OwnedMessage::Close(_) => {
                    let message = Message::close();
                    sender.send_message(&message).ok();
                    let mut senders = CLIENT_SENDERS.lock().unwrap();
                    let index = senders.iter().position(|s| s.0 == client_id);
                    index.map(|index| senders.remove(index));
                    remove_player(&client_id);
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
                                        let mut state = STATE.read().unwrap().state.clone();
                                        state.tag = Some(second.to_string());
                                        broadcast_state(state)
                                    }
                                    ClientOpCode::MutateMyShip => {
                                        serde_json::from_str::<Ship>(second).ok().map(|s| {
                                            mutate_owned_ship_wrapped(
                                                client_id,
                                                s,
                                                third.map(|s| s.to_string()),
                                            )
                                        });
                                    }
                                    ClientOpCode::Name => {
                                        change_player_name(&client_id, second);
                                    }
                                    ClientOpCode::DialogueOption => {
                                        handle_dialogue_option(
                                            &client_id,
                                            serde_json::from_str::<DialogueUpdate>(second)
                                                .ok()
                                                .unwrap(),
                                            third.map(|s| s.to_string()),
                                        );
                                    }
                                    ClientOpCode::Unknown => {}
                                },
                                None => {
                                    eprintln!("Invalid opcode {}", first);
                                }
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
                let message = match message {
                    ServerToClientMessage::StateChange(state) => {
                        Some(ServerToClientMessage::StateChange(patch_state_for_player(
                            state, client_id,
                        )))
                    }
                    ServerToClientMessage::StateChangeExclusive(state, exclude_client_id) => {
                        if client_id != exclude_client_id {
                            Some(ServerToClientMessage::StateChangeExclusive(
                                patch_state_for_player(state, client_id),
                                exclude_client_id,
                            ))
                        } else {
                            None
                        }
                    }
                    ServerToClientMessage::TagConfirm(tag_confirm, target_client_id) => {
                        if client_id == target_client_id {
                            Some(ServerToClientMessage::TagConfirm(
                                tag_confirm,
                                target_client_id,
                            ))
                        } else {
                            None
                        }
                    }
                    ServerToClientMessage::MulticastPartialShipUpdate(ships, exclude_client_id) => {
                        if client_id != exclude_client_id {
                            Some(ServerToClientMessage::MulticastPartialShipUpdate(
                                ships,
                                exclude_client_id,
                            ))
                        } else {
                            None
                        }
                    }
                    ServerToClientMessage::DialogueStateChange(dialogue, target_client_id) => {
                        if client_id == target_client_id {
                            Some(ServerToClientMessage::DialogueStateChange(
                                dialogue,
                                target_client_id,
                            ))
                        } else {
                            None
                        }
                    }
                };
                if let Some(message) = message {
                    let message = Message::text(message.serialize());
                    sender
                        .send_message(&message)
                        .map_err(|e| {
                            eprintln!("Err {} receiving {}", client_id, e);
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

const MAX_ERRORS: u32 = 10;
const MAX_ERRORS_SAMPLE_INTERVAL: i64 = 5000;

fn force_disconnect_client(client_id: &Uuid) {
    let mut senders = CLIENT_SENDERS.lock().unwrap();
    let bad_sender_index = senders.iter().position(|c| c.0 == *client_id);
    if let Some(index) = bad_sender_index {
        eprintln!("force disconnecting client: {}", client_id);
        senders.remove(index);
    }
    remove_player(&client_id);
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
        force_disconnect_client(&client_id);
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

fn change_player_name(conn_id: &Uuid, new_name: &&str) {
    {
        let mut cont = STATE.write().unwrap();
        world::force_update_to_now(&mut cont.state);
        cont.state
            .players
            .iter_mut()
            .find(|p| p.id == *conn_id)
            .map(|p| {
                p.name = new_name.to_string();
            });
    }
    {
        broadcast_state(STATE.read().unwrap().state.clone());
    }
}

lazy_static! {
    static ref DIALOGUE_TABLE: Arc<Mutex<Box<DialogueTable>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

fn handle_dialogue_option(client_id: &Uuid, dialogue_update: DialogueUpdate, _tag: Option<String>) {
    let global_state_change;

    let mut cont = STATE.write().unwrap();
    let mut dialogue_cont = DIALOGUES.lock().unwrap();
    let dialogue_table = DIALOGUE_TABLE.lock().unwrap();
    world::force_update_to_now(&mut cont.state);
    let (new_dialogue_state, state_changed) = world::execute_dialog_option(
        client_id,
        &mut cont.state,
        dialogue_update,
        &mut *dialogue_cont,
        &*dialogue_table,
    );
    unicast_dialogue_state(client_id.clone(), new_dialogue_state);
    global_state_change = state_changed;
    if global_state_change {
        broadcast_state(STATE.read().unwrap().state.clone());
    }
}

fn make_new_human_player(conn_id: &Uuid) {
    {
        let mut cont = STATE.write().unwrap();
        world::add_player(&mut cont.state, conn_id, false, None);
    }
    spawn_ship(conn_id);
}

fn remove_player(conn_id: &Uuid) {
    let mut cont = STATE.write().unwrap();
    cont.state
        .players
        .iter()
        .position(|p| p.id == *conn_id)
        .map(|i| {
            let player = cont.state.players.remove(i);
            player.ship_id.map(|player_ship_id| {
                cont.state
                    .ships
                    .iter()
                    .position(|s| s.id == player_ship_id)
                    .map(|i| cont.state.ships.remove(i))
            })
        });
}

pub fn new_id() -> Uuid {
    Uuid::new_v4()
}

fn spawn_ship(player_id: &Uuid) {
    let mut cont = STATE.write().unwrap();
    world::spawn_ship(&mut cont.state, player_id, None);
}

#[launch]
fn rocket() -> rocket::Rocket {
    unsafe {
        let (tx, rx) = channel::<ServerToClientMessage>();
        DISPATCHER_SENDER = Some(Mutex::new(tx));
        DISPATCHER_RECEIVER = Some(Mutex::new(rx));
    }
    std::thread::spawn(|| {
        websocket_server();
    });

    std::thread::spawn(|| {
        physics_thread();
    });
    std::thread::spawn(|| {
        bot_thread();
    });
    let client_senders = CLIENT_SENDERS.clone();
    thread::spawn(move || unsafe { dispatcher_thread(client_senders) });

    thread::spawn(|| cleanup_thread());

    // You can also deserialize this
    let cors = rocket_cors::CorsOptions {
        allowed_origins: AllowedOrigins::some_exact(&["http://localhost:3000"]),
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
        .mount("/api", routes![get_state, options_state]) // post_state
}

unsafe fn dispatcher_thread(
    client_senders: Arc<Mutex<Vec<(Uuid, Sender<ServerToClientMessage>)>>>,
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
        // cleanup thread - kick broken players, remove ships
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

        let mut cont = STATE.write().unwrap();
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

        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    }
}

const DEBUG_PHYSICS: bool = false;

fn physics_thread() {
    let mut last = Local::now();
    loop {
        thread::sleep(Duration::from_millis(10));
        let mut cont = STATE.write().unwrap();
        let now = Local::now();
        let elapsed = now - last;
        last = now;
        cont.state = world::update(cont.state.clone(), elapsed.num_milliseconds() * 1000, false);
    }
}

use crate::dialogue::{Dialogue, DialogueUpdate};
use crate::random_stuff::gen_bot_name;
use bots::Bot;
lazy_static! {
    static ref BOTS: Arc<Mutex<HashMap<Uuid, Bot>>> = Arc::new(Mutex::new(HashMap::new()));
}

lazy_static! {
    static ref DIALOGUES: Arc<Mutex<Box<DialogueStates>>> =
        Arc::new(Mutex::new(Box::new(HashMap::new())));
}

const BOT_SLEEP_MS: u64 = 200;

fn add_bot(bot: Bot) -> Uuid {
    let mut bots = BOTS.lock().unwrap();
    let id = bot.id.clone();
    bots.insert(id.clone(), bot);
    let mut cont = STATE.write().unwrap();
    world::add_player(&mut cont.state, &id, true, Some(gen_bot_name()));
    world::spawn_ship(&mut cont.state, &id, None);
    id
}

fn bot_thread() {
    add_bot(Bot::new());
    add_bot(Bot::new());
    add_bot(Bot::new());
    add_bot(Bot::new());
    loop {
        let mut ship_updates: HashMap<Uuid, Ship> = HashMap::new();
        let mut bots = BOTS.lock().unwrap();
        let extracted_state = STATE.write().unwrap().state.clone();
        {
            for (bot_id, bot) in bots.clone().iter() {
                let (bot, ship) = bot.clone().act(extracted_state.clone());
                bots.insert(bot_id.clone(), bot);
                if let Some(ship) = ship {
                    ship_updates.insert(bot_id.clone(), ship);
                }
            }
        }
        for (bot_id, ship) in ship_updates.into_iter() {
            mutate_owned_ship_wrapped(bot_id, ship, None);
        }
        thread::sleep(Duration::from_millis(BOT_SLEEP_MS));
    }
}
