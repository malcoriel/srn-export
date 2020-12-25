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

use crate::game::{GameState, Planet, Player, Ship};
mod game;
#[allow(dead_code)]
mod vec2;

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
}

impl ClientMessage {
    pub fn serialize(&self) -> String {
        match self {
            ClientMessage::StateChange(state) => {
                serde_json::to_string::<GameState>(&state).unwrap()
            }
        }
    }
}

static mut DISPATCHER_SENDER: Option<Mutex<Sender<ClientMessage>>> = None;
static mut DISPATCHER_RECEIVER: Option<Mutex<Receiver<ClientMessage>>> = None;

fn new_id() -> Uuid {
    Uuid::new_v4()
}
lazy_static! {
    static ref STATE: RwLock<GameState> = RwLock::new(GameState {
        my_id: new_id(),
        tick: 0,
        planets: vec![
            Planet {
                id: new_id(),
                x: 0.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.0,
            },
            Planet {
                id: new_id(),
                x: 10.0,
                y: 10.0,
                rotation: 0.0,
                radius: 3.0,
            },
            Planet {
                id: new_id(),
                x: 5.0,
                y: 0.0,
                rotation: 0.0,
                radius: 0.5,
            },
            Planet {
                id: new_id(),
                x: 0.0,
                y: 5.0,
                rotation: 0.0,
                radius: 0.5,
            },
        ],
        ships: vec![],
        players: vec![],
    });
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

fn broadcast_state(state: GameState) {
    unsafe {
        let sender = get_dispatcher_sender();
        sender.send(ClientMessage::StateChange(state)).unwrap();
    }
}

unsafe fn get_dispatcher_sender() -> Sender<ClientMessage> {
    DISPATCHER_SENDER.as_ref().unwrap().lock().unwrap().clone()
}

extern crate websocket;
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
    Mutate = 2,
    Name = 3,
}

type WSRequest =
    WsUpgrade<std::net::TcpStream, std::option::Option<websocket::server::upgrade::sync::Buffer>>;

fn websocket_server() {
    let addr = "127.0.0.1:2794";
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
    thread::spawn(move || {
        for message in receiver.incoming_messages() {
            message.map(|m| message_tx.send(m)).ok();
        }
    });

    loop {
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
                                OpCode::Mutate => {
                                    serde_json::from_str::<GameState>(second)
                                        .ok()
                                        .map(|s| mutate_state(s));
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
                ClientMessage::StateChange(state) => {
                    ClientMessage::StateChange(patch_state_for_player(state, client_id))
                }
            };
            let message = Message::text(message.serialize());
            sender.send_message(&message).unwrap();
        }
        thread::sleep(Duration::from_millis(10));
    }
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
        println!("broadcasting");
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
        let client_senders = CLIENT_SENDERS.clone();
        thread::spawn(move || unsafe {
            let unwrapped = DISPATCHER_RECEIVER.as_mut().unwrap().lock().unwrap();
            while let Ok(msg) = unwrapped.recv() {
                for sender in client_senders.lock().unwrap().iter() {
                    sender.1.send(msg.clone()).ok();
                }
            }
            thread::sleep(Duration::from_millis(10))
        });
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
