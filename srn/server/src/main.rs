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
    static ref CLIENT_SENDERS: Arc<Mutex<Vec<Sender<String>>>> = Arc::new(Mutex::new(vec![]));
}

static mut DISPATCHER_SENDER: Option<Mutex<Sender<String>>> = None;
static mut DISPATCHER_RECEIVER: Option<Mutex<Receiver<String>>> = None;

lazy_static! {
    static ref STATE: RwLock<GameState> = RwLock::new(GameState {
        tick: 0,
        planets: vec![
            Planet {
                id: 1,
                x: 0.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.0,
            },
            Planet {
                id: 2,
                x: 10.0,
                y: 10.0,
                rotation: 0.0,
                radius: 3.0,
            },
            Planet {
                id: 3,
                x: 5.0,
                y: 0.0,
                rotation: 0.0,
                radius: 0.5,
            },
            Planet {
                id: 6,
                x: 0.0,
                y: 5.0,
                rotation: 0.0,
                radius: 0.5,
            },
        ],
        ships: vec![
            Ship {
                id: 4,
                x: 0.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.0,
            },
            Ship {
                id: 5,
                x: 1.0,
                y: 3.0,
                rotation: 1.57,
                radius: 1.0,
            },
        ],
        players: vec![Player { id: 1, ship_id: 4 }],
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
        let serialized = serde_json::to_string(&state).unwrap();
        sender.send(serialized).unwrap();
    }
}

unsafe fn get_dispatcher_sender() -> Sender<String> {
    DISPATCHER_SENDER.as_ref().unwrap().lock().unwrap().clone()
}

extern crate websocket;
use num_traits::FromPrimitive;
use std::time::Duration;
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;

#[macro_use]
extern crate num_derive;

#[derive(FromPrimitive, ToPrimitive)]
enum OpCode {
    Unknown = 0,
    Sync = 1,
    Mutate = 2,
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

fn handle_request(request: WSRequest) {
    if !request.protocols().contains(&"rust-websocket".to_string()) {
        request.reject().unwrap();
        return;
    }

    let mut client = request.use_protocol("rust-websocket").accept().unwrap();

    let ip = client.peer_addr().unwrap();

    println!("Connection from {}", ip);

    {
        let state = STATE.read().unwrap().clone();
        let message: Message = Message::text(serde_json::to_string(&state).unwrap());
        client.send_message(&message).unwrap();
    }

    let (client_tx, client_rx) = mpsc::channel();
    CLIENT_SENDERS.lock().unwrap().push(client_tx);

    let (mut receiver, mut sender) = client.split().unwrap();
    let (message_tx, message_rx) = mpsc::channel::<OwnedMessage>();
    thread::spawn(move || {
        for message in receiver.incoming_messages() {
            message_tx.send(message.unwrap()).unwrap();
        }
    });

    loop {
        if let Ok(message) = message_rx.try_recv() {
            match message {
                OwnedMessage::Close(_) => {
                    let message = Message::close();
                    sender.send_message(&message).unwrap();
                    println!("Client {} disconnected", ip);
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
                                _ => {}
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
            let message: Message = Message::text(message);
            sender.send_message(&message).unwrap();
        }
        thread::sleep(Duration::from_millis(10));
    }
}

#[launch]
fn rocket() -> rocket::Rocket {
    unsafe {
        let (tx, rx) = channel::<String>();
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
                    sender.send(msg.clone()).unwrap();
                }
            }
            thread::sleep(Duration::from_millis(10))
        });
    });
    let allowed_origins = AllowedOrigins::some_exact(&["http://localhost:3000"]);

    // You can also deserialize this
    let cors = rocket_cors::CorsOptions {
        allowed_origins,
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
