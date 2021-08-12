use rocket::http::Status;
use rocket::response::Responder;
use rocket::Request;
use rocket_contrib::json::Json;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashSet;
use std::iter::FromIterator;
use std::sync::RwLock;
use std::sync::{RwLockReadGuard, RwLockWriteGuard};
use uuid::Uuid;

use state::Storage;

use crate::api_struct::*;
use crate::events::fire_event;
use crate::states::{add_state, STATE};
use crate::world::GameEvent;
use crate::{new_id, system_gen, world};
use std::thread;
use std::time::Duration;

pub static ROOMS_STATE: Storage<RwLock<RoomsState>> = Storage::new();

pub fn init() {
    ROOMS_STATE.set(RwLock::new(RoomsState::new()));
}

#[get("/")]
pub fn get_rooms() -> Json<Vec<Room>> {
    let rooms = ROOMS_STATE.get().read().unwrap().rooms.clone();
    Json(rooms)
}

#[post("/create/<game_mode>")]
pub fn create_room(game_mode: String) -> Json<RoomIdResponse> {
    let mode =
        serde_json::from_str::<crate::world::GameMode>(format!("\"{}\"", game_mode).as_str());
    if mode.is_err() {
        return Json(RoomIdResponse {
            room_id: Uuid::default(),
        });
    }
    let mode = mode.ok().unwrap();
    let room_id = new_id();
    let room_name = format!("{} - {}", mode, room_id);
    let state = system_gen::seed_room_state(&mode, world::random_hex_seed());
    let cont = &mut ROOMS_STATE.get().write().unwrap();
    cont.rooms.push(Room {
        id: room_id,
        name: room_name,
        state_id: state.id,
        mode,
        clients: vec![],
    });
    log!(format!(
        "created room {} with state {} for mode {}",
        room_id, state.id, game_mode
    ));
    {
        fire_event(GameEvent::NewStateCreated { state });
    }
    cont.reindex();

    return Json(RoomIdResponse { room_id });
}

pub fn find_room_state_id_by_player_id(client_id: Uuid) -> Option<Uuid> {
    let players_to_rooms = ROOMS_STATE
        .get()
        .read()
        .unwrap()
        .players_to_state_ids
        .clone();
    players_to_rooms.get(&client_id).map(|id| id.clone())
}

pub fn find_room_state_id_by_room_id(room_id: RoomId) -> Option<Uuid> {
    let rooms_by_id = &ROOMS_STATE.get().read().unwrap().rooms_states_by_id;
    rooms_by_id.get(&room_id).map(|id| id.clone())
}

pub fn find_room_by_id_mut<'a>(
    cont: &'a mut RwLockWriteGuard<RoomsState>,
    room_id: RoomId,
) -> Option<&'a mut Room> {
    cont.rooms_index_by_id
        .get(&room_id)
        .map(|idx| idx.clone())
        .and_then(move |idx| cont.rooms.get_mut(idx))
}

pub fn try_add_client_to_room(client_id: Uuid, room_id: RoomId, client_name: String) {
    let cont = &mut ROOMS_STATE.get().write().unwrap();
    let room = find_room_by_id_mut(cont, room_id);
    if room.is_none() {
        err!("no room to add player to");
        return;
    }
    let room = room.unwrap();
    room.clients.push(ClientMarker {
        name: client_name,
        client_id,
    });
    cont.reindex();
}

pub const ROOM_CLEANUP_SLEEP_MS: u64 = 500;

pub fn cleanup_empty_rooms() {
    loop {
        let cont = &mut ROOMS_STATE.get().write().unwrap();
        let to_drop: HashSet<RoomId> = HashSet::from_iter(
            cont.rooms
                .iter()
                .filter_map(|room| {
                    if room.clients.len() == 0 {
                        Some(room.id.clone())
                    } else {
                        None
                    }
                })
                .collect::<Vec<Uuid>>()
                .into_iter(),
        );
        cont.rooms.retain(|r| {
            let keep = !to_drop.contains(&r.id);
            if !keep {
                log!(format!("dropping room {} without players", r.id));
            }
            keep
        });
        thread::sleep(Duration::from_millis(ROOM_CLEANUP_SLEEP_MS));
    }
}
