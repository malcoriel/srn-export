use crate::{new_id, WSRequest};
use chrono::{DateTime, Utc};
use lazy_static::lazy_static;
use objekt_clonable::objekt::private::sync::mpsc::{Receiver, Sender};
use serde_derive::{Deserialize, Serialize};
use serde_json::Error;
use std::collections::HashMap;
use std::sync::mpsc::channel;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use uuid::Uuid;
use websocket::server::upgrade::WsUpgrade;
use websocket::sync::Server;
use websocket::{Message, OwnedMessage};

lazy_static! {
    static ref CHAT_CLIENT_SENDERS: Arc<Mutex<Vec<(Uuid, Sender<ServerChatMessage>)>>> =
        Arc::new(Mutex::new(vec![]));
}

fn init() -> (
    Arc<Mutex<Sender<ServerChatMessage>>>,
    Arc<Mutex<Receiver<ServerChatMessage>>>,
) {
    let (sender, receiver) = channel::<ServerChatMessage>();
    (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
}

lazy_static! {
    static ref CHAT_DISPATCHER_CHANNEL: (
        Arc<Mutex<Sender<ServerChatMessage>>>,
        Arc<Mutex<Receiver<ServerChatMessage>>>
    ) = init();
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ChatMessage {
    pub name: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ServerChatMessage {
    pub channel: String,
    pub message: ChatMessage,
}

impl ServerChatMessage {
    pub fn global_server(msg: &str) -> ServerChatMessage {
        ServerChatMessage {
            channel: "global".to_string(),
            message: ChatMessage {
                name: "Server".to_string(),
                message: msg.to_string(),
            },
        }
    }
}

impl ChatMessage {
    pub fn server(msg: &str) -> ChatMessage {
        ChatMessage {
            name: "Server".to_string(),
            message: msg.to_string(),
        }
    }
}

fn broadcast_message(msg: ServerChatMessage) {
    let sender = CHAT_DISPATCHER_CHANNEL.0.lock().unwrap();
    sender.send(msg).unwrap();
}

fn dispatcher_thread() {
    let client_senders = CHAT_CLIENT_SENDERS.clone();
    let unwrapped = CHAT_DISPATCHER_CHANNEL.1.lock().unwrap();
    while let Ok(msg) = unwrapped.recv() {
        for sender in client_senders.lock().unwrap().iter() {
            let send = sender.1.send(msg.clone());
            if let Err(e) = send {
                eprintln!("err {} sending {}", sender.0, e);
                increment_client_errors(sender.0);
                disconnect_if_bad(sender.0);
            }
        }
        thread::sleep(Duration::from_millis(CHAT_SLEEP_MS))
    }
    thread::sleep(Duration::from_millis(CHAT_SLEEP_MS))
}

pub fn chat_server() {
    let addr = "0.0.0.0:2795";
    let server = Server::bind(addr).unwrap();
    println!("Chat server has launched on {}", addr);

    thread::spawn(|| dispatcher_thread());

    for request in server.filter_map(Result::ok) {
        thread::spawn(|| handle_request(request));
    }
}

fn is_disconnected(client_id: Uuid) -> bool {
    let senders = CHAT_CLIENT_SENDERS.lock().unwrap();
    let index = senders.iter().position(|s| s.0 == client_id);
    if index.is_none() {
        // client disconnected
        return true;
    }
    return false;
}

const CHAT_SLEEP_MS: u64 = 100;

fn handle_request(request: WSRequest) {
    if !request.protocols().contains(&"rust-websocket".to_string()) {
        request.reject().unwrap();
        return;
    }

    let client = request.use_protocol("rust-websocket").accept().unwrap();

    let ip = client.peer_addr().unwrap();
    let client_id = new_id();

    log!(format!("Chat connection from {}, id={}", ip, client_id));

    let (client_tx, client_rx) = mpsc::channel::<ServerChatMessage>();
    CHAT_CLIENT_SENDERS
        .lock()
        .unwrap()
        .push((client_id, client_tx));

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
                warn!(format!("err {} receiving ws {}", client_id, e));
                increment_client_errors(client_id);
            }
        }
        thread::sleep(Duration::from_millis(CHAT_SLEEP_MS));
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
                    let mut senders = CHAT_CLIENT_SENDERS.lock().unwrap();
                    let index = senders.iter().position(|s| s.0 == client_id);
                    index.map(|index| senders.remove(index));
                    log!(format!("Chat client {} id {} disconnected", ip, client_id));
                    broadcast_message(ServerChatMessage::global_server("a user disconnected"));
                    return;
                }
                OwnedMessage::Ping(msg) => {
                    let message = Message::pong(msg);
                    sender.send_message(&message).unwrap();
                }
                OwnedMessage::Text(msg) => {
                    match serde_json::from_str::<ServerChatMessage>(msg.as_str()) {
                        Ok(msg) => {
                            broadcast_message(msg);
                        }
                        Err(err) => {
                            warn!(format!("Corrupted message {}: {}", msg, err))
                        }
                    }
                }
                _ => {}
            }
        }
        if let Ok(message) = client_rx.try_recv() {
            if !is_disconnected(client_id) {
                let message = Message::text(serde_json::to_string(&message).unwrap());
                sender
                    .send_message(&message)
                    .map_err(|e| {
                        warn!(format!("err {} sending {}", client_id, e));
                        increment_client_errors(client_id);
                        disconnect_if_bad(client_id);
                    })
                    .ok();
            }
        }
        thread::sleep(Duration::from_millis(CHAT_SLEEP_MS));
    }
}

lazy_static! {
    static ref CHAT_CLIENT_ERRORS: Arc<Mutex<HashMap<Uuid, u32>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

const MAX_ERRORS: u32 = 10;
const MAX_ERRORS_SAMPLE_INTERVAL: i64 = 5000;

fn increment_client_errors(client_id: Uuid) {
    let mut errors = CHAT_CLIENT_ERRORS.lock().unwrap();
    let entry = errors.entry(client_id).or_insert(0);
    *entry += 1;
}

struct LastCheck {
    time: DateTime<Utc>,
}

lazy_static! {
    static ref CHAT_CLIENT_ERRORS_LAST_CHECK: Arc<Mutex<LastCheck>> =
        Arc::new(Mutex::new(LastCheck { time: Utc::now() }));
}

fn disconnect_if_bad(client_id: Uuid) -> bool {
    let mut errors = CHAT_CLIENT_ERRORS.lock().unwrap();
    let mut last_check = CHAT_CLIENT_ERRORS_LAST_CHECK.lock().unwrap();
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

fn force_disconnect_client(client_id: Uuid) {
    let mut senders = CHAT_CLIENT_SENDERS.lock().unwrap();
    let bad_sender_index = senders.iter().position(|c| c.0 == client_id);
    if let Some(index) = bad_sender_index {
        eprintln!("force disconnecting chat client: {}", client_id);
        senders.remove(index);
    }
}
