#[cfg(feature = "serde_derive")]
#[allow(unused_imports)]
#[macro_use]
extern crate serde_derive;
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;
use std::sync::{mpsc, Arc, Mutex, RwLock};
#[macro_use]
extern crate rocket;
use rocket_contrib::json::Json;
use std::thread;
use uuid::*;
extern crate rocket_cors;

use crate::game::{GameState, Planet, Player, Ship, Star};
mod game;
#[allow(dead_code)]
mod vec2;
mod vec2_test;
mod world;
mod world_test;

use mpsc::{channel, Receiver, Sender};
use rocket::http::Method;
use rocket_cors::{AllowedHeaders, AllowedOrigins};

use lazy_static::lazy_static;
use websocket::{Message, OwnedMessage};

lazy_static! {
    static ref CLIENT_SENDERS: Arc<Mutex<Vec<(Uuid, Sender<ClientMessage>)>>> =
        Arc::new(Mutex::new(vec![]));
}

#[derive(Debug, Clone)]
enum ClientMessage {
    StateChange(GameState),
    StateChangeExclusive(GameState, Uuid),
}

impl ClientMessage {
    pub fn serialize(&self) -> String {
        match self {
            ClientMessage::StateChange(state) => {
                serde_json::to_string::<GameState>(&state).unwrap()
            }
            ClientMessage::StateChangeExclusive(state, _unused) => {
                serde_json::to_string::<GameState>(&state).unwrap()
            }
        }
    }
}

static mut DISPATCHER_SENDER: Option<Mutex<Sender<ClientMessage>>> = None;
static mut DISPATCHER_RECEIVER: Option<Mutex<Receiver<ClientMessage>>> = None;
static SEED_TIME: i64 = 9321 * 1000 * 1000;

fn new_id() -> Uuid {
    Uuid::new_v4()
}
lazy_static! {
    static ref STATE: RwLock<GameState> = {
        let star_id = new_id();
        let star = Star {
            color: "yellow".to_string(),
            id: star_id.clone(),
            name: "Zinides".to_string(),
            x: 0.0,
            y: 0.0,
            rotation: 0.0,
            radius: 10.0,
        };

        let small_id = new_id();

        let small_planet = Planet {
            id: small_id,
            color: "blue".to_string(),
            name: "Dabayama".to_string(),
            x: 19.0,
            y: 0.0,
            rotation: 0.0,
            radius: 1.0,
            orbit_speed: 0.1,
            anchor_id: star_id.clone(),
            anchor_tier: 1,
        };

        let sat1 = Planet {
            color: "gray".to_string(),
            id: new_id(),
            name: "D1".to_string(),
            x: 21.9,
            y: 0.0,
            rotation: 0.0,
            radius: 0.3,
            orbit_speed: 0.3,
            anchor_id: small_id.clone(),
            anchor_tier: 2,
        };

        let sat2 = Planet {
            color: "gray".to_string(),
            id: new_id(),
            name: "D2".to_string(),
            x: 20.7,
            y: 0.0,
            rotation: 0.0,
            radius: 0.5,
            orbit_speed: 0.5,
            anchor_id: small_id.clone(),
            anchor_tier: 2,
        };

        let mut state = GameState {
            my_id: new_id(),
            tick: 0,
            star,
            planets: vec![
                Planet {
                    color: "orange".to_string(),
                    id: new_id(),
                    name: "Robrapus".to_string(),
                    x: 15.0,
                    y: 0.0,
                    rotation: 0.0,
                    radius: 0.5,
                    orbit_speed: 0.03,
                    anchor_id: star_id.clone(),
                    anchor_tier: 1,
                },
                small_planet,
                sat1,
                sat2,
                Planet {
                    color: "greenyellow".to_string(),
                    id: new_id(),
                    name: "Eustea".to_string(),
                    x: 40.0,
                    y: 0.0,
                    rotation: 0.0,
                    radius: 0.5,
                    orbit_speed: 0.08,
                    anchor_id: star_id.clone(),
                    anchor_tier: 1,
                },
                Planet {
                    color: "orange".to_string(),
                    id: new_id(),
                    name: "Sunov".to_string(),
                    x: 30.0,
                    y: 0.0,
                    rotation: 0.0,
                    radius: 3.0,
                    orbit_speed: 0.01,
                    anchor_id: star_id.clone(),
                    anchor_tier: 1,
                },
            ],
            ships: vec![],
            players: vec![],
        };
        eprintln!("{}", serde_json::to_string_pretty(&state,).ok().unwrap());
        state.planets = world::update_planets(&state.planets, &state.star, SEED_TIME);
        RwLock::new(state)
    };
}

#[get("/state")]
fn get_state() -> Json<GameState> {
    Json(STATE.read().unwrap().clone())
}

#[options("/state")]
fn options_state() {}

#[post("/state", data = "<state>")]
fn post_state(state: Json<GameState>) {
    mutate_state(state.into_inner());
}

fn mutate_state(state: GameState) {
    let mut mut_state = STATE.write().unwrap();
    mut_state.ships = state.ships.clone();
    mut_state.tick = mut_state.tick + 1;
    broadcast_state(mut_state.clone());
}

use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ClientErr {
    message: String,
}

fn mutate_owned_ship_wrapped(client_id: Uuid, new_ship: Ship) {
    let res = mutate_owned_ship(client_id, new_ship);
    if res.is_err() {
        eprintln!("error mutating owned ship {}", res.err().unwrap().message);
        // TODO send targeted message to client that his request was denied
    }
}

fn mutate_owned_ship(client_id: Uuid, new_ship: Ship) -> Result<Ship, ClientErr> {
    let updated_ship: Ship;
    let old_ship_index;
    {
        let state = STATE.read().unwrap();
        let player = state.players.iter().find(|p| p.id == client_id);
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
        let old_ship = state
            .ships
            .iter()
            .position(|s| s.id == player.unwrap().ship_id.unwrap());
        if old_ship.is_none() {
            return Err(ClientErr {
                message: String::from("No old instance of ship"),
            });
        }
        old_ship_index = old_ship.clone();
        let old_ship = state.ships[old_ship.unwrap()].clone();
        let ok = validate_ship_move(&old_ship, &new_ship);
        if !ok {
            updated_ship = old_ship;
        } else {
            updated_ship = new_ship;
        }
    }
    {
        let mut mut_state = STATE.write().unwrap();
        mut_state.ships.remove(old_ship_index.unwrap());
        mut_state.tick = mut_state.tick + 1;
        mut_state.ships.push(updated_ship.clone());
        multicast_state_excluding(mut_state.clone(), client_id);
        return Ok(updated_ship);
    }
}

fn validate_ship_move(_old: &Ship, _new: &Ship) -> bool {
    // some anti-cheat needed
    return true;
}

fn broadcast_state(state: GameState) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender.send(ClientMessage::StateChange(state)).unwrap();
    }
}

fn multicast_state_excluding(state: GameState, client_id: Uuid) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender
            .send(ClientMessage::StateChangeExclusive(state, client_id))
            .unwrap();
    }
}

unsafe fn get_dispatcher_sender() -> Sender<ClientMessage> {
    DISPATCHER_SENDER.as_ref().unwrap().lock().unwrap().clone()
}

extern crate websocket;
use chrono::Local;
use num_traits::FromPrimitive;
use std::time::Duration;
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;

#[macro_use]
extern crate num_derive;

#[derive(FromPrimitive, ToPrimitive, Debug, Clone)]
enum OpCode {
    Unknown = 0,
    Sync = 1,
    MutateMyShip = 2,
    Name = 3,
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

const DEFAULT_SLEEP_MS: u64 = 10;

fn handle_request(request: WSRequest) {
    if !request.protocols().contains(&"rust-websocket".to_string()) {
        request.reject().unwrap();
        return;
    }

    let mut client = request.use_protocol("rust-websocket").accept().unwrap();

    let ip = client.peer_addr().unwrap();

    let client_id = Uuid::new_v4();
    println!("Connection from {}, id={}", ip, client_id);

    make_new_player(&client_id);
    {
        let mut state = STATE.read().unwrap().clone();
        state = patch_state_for_player(state, client_id);
        let message: Message = Message::text(serde_json::to_string(&state).unwrap());
        client.send_message(&message).unwrap();
    }

    let (client_tx, client_rx) = mpsc::channel::<ClientMessage>();
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
            Err(e) => eprintln!("err receiving ws {}", e),
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    });

    loop {
        if is_disconnected(client_id) {
            break;
        }

        if let Ok(message) = message_rx.try_recv() {
            match message {
                OwnedMessage::Close(_) => {
                    let message = Message::close();
                    sender.send_message(&message).unwrap();
                    let mut senders = CLIENT_SENDERS.lock().unwrap();
                    let index = senders.iter().position(|s| s.0 == client_id);
                    index.map(|index| senders.remove(index));
                    remove_player(&client_id);
                    println!("Client {} id {} disconnected", ip, client_id);
                    broadcast_state(STATE.read().unwrap().clone());
                    return;
                }
                OwnedMessage::Ping(msg) => {
                    let message = Message::pong(msg);
                    sender.send_message(&message).unwrap();
                }
                OwnedMessage::Text(msg) => {
                    let parts = msg.split("_%_").collect::<Vec<&str>>();
                    if parts.len() != 2 {
                        eprintln!("Corrupt message (not 2 parts) {}", msg);
                    }
                    let first = parts.iter().nth(0).unwrap();
                    let second = parts.iter().nth(1).unwrap();

                    match first.parse::<u32>() {
                        Ok(number) => match FromPrimitive::from_u32(number) {
                            Some(op_code) => match op_code {
                                OpCode::Sync => {
                                    let state = STATE.read().unwrap().clone();
                                    broadcast_state(state)
                                }
                                OpCode::MutateMyShip => {
                                    serde_json::from_str::<Ship>(second)
                                        .ok()
                                        .map(|s| mutate_owned_ship_wrapped(client_id, s));
                                }
                                OpCode::Name => {
                                    change_player_name(&client_id, second);
                                }
                                OpCode::Unknown => {}
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
                _ => {}
            }
        }
        if let Ok(message) = client_rx.try_recv() {
            let message = match message {
                ClientMessage::StateChange(state) => Some(ClientMessage::StateChange(
                    patch_state_for_player(state, client_id),
                )),
                ClientMessage::StateChangeExclusive(state, exclude_client_id) => {
                    if client_id != exclude_client_id {
                        Some(ClientMessage::StateChange(patch_state_for_player(
                            state, client_id,
                        )))
                    } else {
                        None
                    }
                }
            };
            if let Some(message) = message {
                let message = Message::text(message.serialize());
                sender
                    .send_message(&message)
                    .map_err(|e| eprintln!("Err receiving {}", e))
                    .ok();
            }
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS));
    }
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
        let mut state = STATE.write().unwrap();
        state.tick += 1;
        state
            .players
            .iter_mut()
            .find(|p| p.id == *conn_id)
            .map(|p| {
                p.name = new_name.to_string();
            });
    }
    {
        broadcast_state(STATE.read().unwrap().clone());
    }
}

fn make_new_player(conn_id: &Uuid) {
    {
        let mut state = STATE.write().unwrap();
        state.players.push(Player {
            id: conn_id.clone(),
            ship_id: None,
            name: conn_id.to_string(),
        });
    }
    spawn_ship(conn_id);
}

fn remove_player(conn_id: &Uuid) {
    let mut state = STATE.write().unwrap();
    state
        .players
        .iter()
        .position(|p| p.id == *conn_id)
        .map(|i| {
            let player = state.players.remove(i);
            player.ship_id.map(|player_ship_id| {
                state
                    .ships
                    .iter()
                    .position(|s| s.id == player_ship_id)
                    .map(|i| state.ships.remove(i))
            })
        });
}

fn spawn_ship(player_id: &Uuid) {
    let mut state = STATE.write().unwrap();
    let ship = Ship {
        id: new_id(),
        color: "blue".to_string(),
        x: 0.0,
        y: 0.0,
        rotation: 0.0,
        radius: 1.0,
    };
    state
        .players
        .iter_mut()
        .find(|p| p.id == *player_id)
        .map(|p| p.ship_id = Some(ship.id));
    state.ships.push(ship);
}

#[launch]
fn rocket() -> rocket::Rocket {
    unsafe {
        let (tx, rx) = channel::<ClientMessage>();
        DISPATCHER_SENDER = Some(Mutex::new(tx));
        DISPATCHER_RECEIVER = Some(Mutex::new(rx));
    }
    std::thread::spawn(|| {
        websocket_server();
    });

    std::thread::spawn(|| {
        physics_thread();
    });
    let client_senders = CLIENT_SENDERS.clone();
    thread::spawn(move || unsafe {
        let unwrapped = DISPATCHER_RECEIVER.as_mut().unwrap().lock().unwrap();
        while let Ok(msg) = unwrapped.recv() {
            for sender in client_senders.lock().unwrap().iter() {
                let send = sender.1.send(msg.clone());
                if let Err(e) = send {
                    eprintln!("err sending {}", e);
                }
            }
            thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS))
        }
        thread::sleep(Duration::from_millis(DEFAULT_SLEEP_MS))
    });

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
        .mount("/api", routes![get_state, post_state, options_state])
}

const DEBUG_PHYSICS: bool = false;

fn physics_thread() {
    let mut last = Local::now();
    loop {
        thread::sleep(Duration::from_millis(1000));
        let mut state = STATE.write().unwrap();
        let now = Local::now();
        let elapsed = now - last;
        last = now;
        state.planets = world::update_planets(
            &state.planets,
            &state.star,
            elapsed.num_microseconds().unwrap(),
        );
    }
}
