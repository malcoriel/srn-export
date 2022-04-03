use std::collections::HashMap;
use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::thread;
use std::time::Duration;

use chrono::Utc;
use crossbeam::channel::{bounded, Receiver, Sender};
use lazy_static::lazy_static;
use lockfree::set::Set as LockFreeSet;
use num_traits::FromPrimitive;
use uuid::Uuid;
use websocket::client::sync::Writer;
use websocket::server::sync::Server;
use websocket::server::upgrade::WsUpgrade;
use websocket::{Message, OwnedMessage};

use crate::dialogue::{execute_dialog_option, DialogueUpdate,Dialogue};
use crate::get_prng;
use crate::indexing::find_my_player;
use crate::net::{
    ClientOpCode, PersonalizeUpdate, ServerToClientMessage, ShipsWrapper, SwitchRoomPayload,
    TagConfirm, Wrapper,
};
use crate::world_actions::Action;
use crate::states::{get_state_id_cont, select_state, select_state_mut, STATE};
use crate::world::{GameState, Player, Ship};
use crate::world_actions::is_world_update_action;
use crate::world_events::GameEvent;
use crate::xcast::XCast;
use crate::{
    dialogue, indexing, inventory, long_actions, market, notifications, sandbox,
    states, world, xcast, DialogueRequest, LastCheck, WSRequest, DEFAULT_SLEEP_MS,
    DIALOGUE_TABLE, MAX_ERRORS, MAX_ERRORS_SAMPLE_INTERVAL, MAX_MESSAGES_PER_INTERVAL,
    MAX_MESSAGE_SAMPLE_INTERVAL_MS,
};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};

lazy_static! {
    pub static ref DISPATCHER: (
        Arc<Mutex<Sender<ServerToClientMessage>>>,
        Arc<Mutex<Receiver<ServerToClientMessage>>>
    ) = {
        let (sender, receiver) = bounded::<ServerToClientMessage>(128);
        (Arc::new(Mutex::new(sender)), Arc::new(Mutex::new(receiver)))
    };
}

lazy_static! {
    static ref CLIENT_SENDERS: Arc<Mutex<Vec<(Uuid, Sender<ServerToClientMessage>)>>> =
        Arc::new(Mutex::new(vec![]));
}

lazy_static! {
    static ref CLIENT_SENDERS_SET: LockFreeSet<Uuid> = LockFreeSet::new();
}

lazy_static! {
    static ref CLIENT_ERRORS_LAST_CHECK: Arc<Mutex<LastCheck>> =
        Arc::new(Mutex::new(LastCheck { time: Utc::now() }));
}

lazy_static! {
    static ref CLIENT_MESSAGE_COUNTS_LAST_CHECK: Arc<Mutex<LastCheck>> =
        Arc::new(Mutex::new(LastCheck { time: Utc::now() }));
}

lazy_static! {
    static ref CLIENT_ERRORS: Arc<Mutex<HashMap<Uuid, u32>>> = Arc::new(Mutex::new(HashMap::new()));
}
lazy_static! {
    static ref CLIENT_MESSAGE_COUNTS: Arc<Mutex<HashMap<Uuid, u32>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

pub fn websocket_server() {
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

    let client = request.use_protocol("rust-websocket").accept().unwrap();

    let ip = client.peer_addr().unwrap();

    let client_id = Uuid::new_v4();
    println!("Connection from {}, id={}", ip, client_id);

    let (public_client_sender, public_client_receiver) = bounded::<ServerToClientMessage>(128);
    CLIENT_SENDERS
        .lock()
        .unwrap()
        .push((client_id, public_client_sender));
    if let Err(err) = CLIENT_SENDERS_SET.insert(client_id) {
        warn!(format!("error reindexing clients on connect: {:?}", err));
    }

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
                OwnedMessage::Text(msg) => on_client_text_message(client_id, msg),
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

pub fn x_cast_state(state: GameState, x_cast: XCast) {
    DISPATCHER
        .0
        .lock()
        .unwrap()
        .send(ServerToClientMessage::XCastStateChange(state, x_cast))
        .unwrap();
}

pub fn send_tag_confirm(tag: String, client_id: Uuid) {
    DISPATCHER
        .0
        .lock()
        .unwrap()
        .send(ServerToClientMessage::TagConfirm(
            TagConfirm { tag },
            client_id,
        ))
        .unwrap();
}

fn on_message_to_send_to_client(
    client_id: Uuid,
    sender: &mut Writer<TcpStream>,
    message: &ServerToClientMessage,
) {
    if is_disconnected(client_id) {
        return;
    }
    let cont = STATE.read().unwrap();
    let current_state_id = get_state_id_cont(&cont, client_id);
    let should_send: bool = current_state_id.map_or(false, |current_state_id| {
        xcast::check_message_casting(client_id, &message, current_state_id)
    });
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

fn check_message_overflow_happened(client_id: Uuid) -> bool {
    let mut message_counts = CLIENT_MESSAGE_COUNTS.lock().unwrap();
    let mut last_check = CLIENT_MESSAGE_COUNTS_LAST_CHECK.lock().unwrap();
    let now = Utc::now();
    let diff = (last_check.time - now).num_milliseconds().abs();
    if diff > MAX_MESSAGE_SAMPLE_INTERVAL_MS {
        last_check.time = now;
        *message_counts = HashMap::new();
    }

    let current_count = message_counts.entry(client_id).or_insert(0);
    if *current_count > MAX_MESSAGES_PER_INTERVAL {
        warn!(format!(
            "message overflow from client {}, skipping",
            client_id
        ));
        increment_client_errors(client_id);
        return true;
    }
    (*current_count) += 1;
    return false;
}

fn on_client_text_message(client_id: Uuid, msg: String) {
    if check_message_overflow_happened(client_id) {
        return;
    }
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
            warn!("Unsupported client op code 'Sync'");
        }
        ClientOpCode::MutateMyShip => {
            warn!("Unsupported client op code 'MutateMyShip'");
        },
        ClientOpCode::Name => on_client_personalize(client_id, second),
        ClientOpCode::DialogueOption => {
            warn!("Unsupported client op code 'DialogueOption'");
        }
        ClientOpCode::SwitchRoom => on_client_switch_room(client_id, second),
        ClientOpCode::SandboxCommand => {
            on_client_sandbox_command(client_id, second, third);
        }
        ClientOpCode::TradeAction => {
            on_client_trade_action(client_id, second, third);
        }
        ClientOpCode::Unknown => {}
        ClientOpCode::DialogueRequest => {
            warn!("Unsupported client op code 'DialogueRequest'");
        }
        ClientOpCode::InventoryAction => {
            on_client_inventory_action(client_id, second, third);
        }
        ClientOpCode::ObsoleteLongActionStart => {
            warn!(format!("usage of obsolete opcode LongActionStart"));
            on_client_long_action_start(client_id, second, third);
        }
        ClientOpCode::ObsoleteRoomJoin => {
            eprintln!("usage of obsolete opcode RoomJoin");
        }
        ClientOpCode::NotificationAction => {
            on_client_notification_action(client_id, second, third);
        }
        ClientOpCode::SchedulePlayerAction => {
            on_client_schedule_player_action(client_id, second, third);
        }
    };
}

fn on_client_room_join(client_id: Uuid) {
    let mut cont = STATE.write().unwrap();
    let state = states::select_state_mut(&mut cont, client_id);
    if state.is_none() {
        warn!("room join in non-existent state");
        return;
    }
    let state = state.unwrap();
    let player = find_my_player(&state, client_id);
    if let Some(player) = player {
        crate::fire_event(GameEvent::RoomJoined {
            personal: true,
            mode: state.mode.clone(),
            player_id: player.id,
        });
    }
}

fn on_client_long_action_start(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<long_actions::LongActionStart>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("long action start in non-existent state");
                return;
            }
            let state = state.unwrap();
            // let action_dbg = action.clone();
            if !long_actions::try_start_long_action(state, client_id, action, &mut get_prng()) {
                // invalid shooting produces too much noise
                // warn!(format!(
                //     "Impossible long action for client {}, action {:?}",
                //     client_id, action_dbg
                // ));
            }
            x_cast_state(state.clone(), XCast::Unicast(state.id, client_id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!("couldn't parse long action start {}, err {}", data, err);
        }
    }
}

fn on_client_notification_action(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<notifications::NotificationAction>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("notification action in non-existent state");
                return;
            }
            let state = state.unwrap();
            notifications::apply_action(state, client_id, action);
            x_cast_state(state.clone(), XCast::Unicast(state.id, client_id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!("couldn't parse notification action {}, err {}", data, err);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct SchedulePlayerAction {
    action: Action,
}

fn on_client_schedule_player_action(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<SchedulePlayerAction>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("schedule player action in non-existent state");
                return;
            }
            let state = state.unwrap();
            if is_world_update_action(&action.action) {
                state.player_actions.push_back(action.action);
            } else {
                warn!(format!(
                    "schedule player action does not support that player action: {:?}",
                    action.action
                ));
            }
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            warn!(format!(
                "couldn't schedule player action {}, err {}",
                data, err
            ));
        }
    }
}

fn on_client_switch_room(client_id: Uuid, second: &&str) {
    let parsed = serde_json::from_str::<SwitchRoomPayload>(second);
    match parsed {
        Ok(parsed) => {
            states::move_player_to_room(client_id, parsed.room_id);
            on_client_room_join(client_id);
        }
        Err(err) => {
            warn!(format!("Bad switch room, err is {}", err));
        }
    }
}

fn on_client_personalize(client_id: Uuid, second: &&str) {
    let parsed = serde_json::from_str::<PersonalizeUpdate>(second);
    match parsed {
        Ok(up) => {
            let mut cont = STATE.write().unwrap();
            let state = select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("personalize in non-existent state");
                return;
            }
            let state = state.unwrap();
            crate::personalize_player(state, client_id, up);
        }
        Err(_) => {}
    }
}

fn on_client_sandbox_command(client_id: Uuid, second: &&str, third: Option<&&str>) {
    let parsed = serde_json::from_str::<sandbox::SandboxCommand>(second);
    match parsed {
        Ok(res) => {
            let mut cont = STATE.write().unwrap();
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("sandbox command in non-existent state");
                return;
            }
            let state = state.unwrap();
            if state.mode != world::GameMode::Sandbox {
                warn!(format!(
                    "Attempt to send a sandbox command to non-sandbox state by client {}",
                    client_id
                ));
                return;
            }
            sandbox::mutate_state(state, client_id, res);
            send_tag_confirm(third.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!("couldn't parse sandbox action {}, err {}", second, err);
        }
    }
}

fn on_client_trade_action(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<market::TradeAction>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("trade action in non-existent state");
                return;
            }
            let state = state.unwrap();
            market::attempt_trade(state, client_id, action, &mut get_prng());
            x_cast_state(state.clone(), XCast::Broadcast(state.id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!("couldn't parse trade action {}, err {}", data, err);
        }
    }
}

fn on_client_inventory_action(client_id: Uuid, data: &&str, tag: Option<&&str>) {
    let parsed = serde_json::from_str::<inventory::InventoryAction>(data);
    match parsed {
        Ok(action) => {
            let mut cont = STATE.write().unwrap();
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("inventory action in non-existent state");
                return;
            }
            let state = state.unwrap();
            if let Some(ship) = indexing::find_my_ship_mut(state, client_id) {
                inventory::apply_action(&mut ship.inventory, action);
            }
            x_cast_state(state.clone(), XCast::Unicast(state.id, client_id));
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!("couldn't parse trade action {}, err {}", data, err);
        }
    }
}

fn force_disconnect_client(client_id: Uuid) {
    let mut senders = CLIENT_SENDERS.lock().unwrap();
    CLIENT_SENDERS_SET.remove(&client_id);
    let bad_sender_index = senders.iter().position(|c| c.0 == client_id);
    if let Some(index) = bad_sender_index {
        eprintln!("force disconnecting client: {}", client_id);
        senders.remove(index);
    }
    let mut cont = STATE.write().unwrap();
    let state = select_state_mut(&mut cont, client_id);
    if state.is_none() {
        warn!("force disconnect in non-existent state");
        return;
    }
    let state = state.unwrap();
    crate::remove_player(client_id, state);
}

pub fn disconnect_if_bad(client_id: Uuid) -> bool {
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

pub fn increment_client_errors(client_id: Uuid) {
    let mut errors = CLIENT_ERRORS.lock().unwrap();
    let entry = errors.entry(client_id).or_insert(0);
    *entry += 1;
}

pub fn dispatcher_thread() {
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

pub fn kick_player(player_id: Uuid) {
    dispatch(ServerToClientMessage::RoomLeave(player_id));
}

fn on_client_close(ip: SocketAddr, client_id: Uuid, sender: &mut Writer<TcpStream>) {
    let message = Message::close();
    sender.send_message(&message).ok();
    let mut senders = CLIENT_SENDERS.lock().unwrap();
    CLIENT_SENDERS_SET.remove(&client_id);
    let index = senders.iter().position(|s| s.0 == client_id);
    index.map(|index| senders.remove(index));
    {
        let mut cont = STATE.write().unwrap();
        let state = select_state_mut(&mut cont, client_id);
        if state.is_none() {
            warn!("remove player in non-existent state");
            return;
        }
        let state = state.unwrap();
        crate::remove_player(client_id, state);
    }
    println!("Client {} id {} disconnected", ip, client_id);
    let cont = STATE.read().unwrap();
    let state = select_state(&cont, client_id);
    if state.is_none() {
        warn!("xcast of non-existent state");
        return;
    }
    let state = state.unwrap();
    let state_id = state.id.clone();
    x_cast_state(state.clone(), XCast::Broadcast(state_id));
}

pub fn is_disconnected(client_id: Uuid) -> bool {
    return !CLIENT_SENDERS_SET.contains(&client_id);
}

pub fn notify_state_changed(state_id: Uuid, target_client_id: Uuid) {
    DISPATCHER
        .0
        .lock()
        .unwrap()
        .send(ServerToClientMessage::RoomSwitched(XCast::Unicast(
            state_id,
            target_client_id,
        )))
        .unwrap();
}

pub fn unicast_dialogue_state(
    client_id: Uuid,
    dialogue_state: Option<Dialogue>,
    current_state_id: Uuid,
) {
    DISPATCHER
        .0
        .lock()
        .unwrap()
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

pub fn multicast_ships_update_excluding(
    ships: Vec<Ship>,
    client_id: Option<Uuid>,
    current_state_id: Uuid,
) {
    DISPATCHER
        .0
        .lock()
        .unwrap()
        .send(ServerToClientMessage::MulticastPartialShipUpdate(
            ShipsWrapper { ships },
            client_id,
            current_state_id,
        ))
        .unwrap();
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
            let state = states::select_state_mut(&mut cont, client_id);
            if state.is_none() {
                warn!("dialogue request in non-existent state");
                return;
            }
            let state = state.unwrap();
            if let Some(player) = find_my_player(state, client_id) {
                crate::fire_event(GameEvent::DialogueTriggerRequest {
                    dialogue_name: "basic_planet".to_string(),
                    player_id: player.id,
                })
            }
            send_tag_confirm(tag.unwrap().to_string(), client_id);
        }
        Err(err) => {
            eprintln!("couldn't parse dialogue request {}, err {}", data, err);
        }
    }
}

pub fn cleanup_bad_clients_thread() {
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

pub fn send_event_to_client(ev: GameEvent, x_cast: XCast) {
    let sender = DISPATCHER.0.lock().unwrap();
    sender
        .send(ServerToClientMessage::XCastGameEvent(
            Wrapper::new(ev),
            x_cast,
        ))
        .unwrap();
}
