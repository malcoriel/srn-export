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

#[post("/<game_mode>/create")]
pub fn create_room(game_mode: String) -> Status {
    let mode = serde_json::from_str::<crate::world::GameMode>(game_mode.as_str());
    if mode.is_err() {
        return Status::BadRequest;
    }

    return Status::Ok;
}

pub fn find_room_state_id_by_player_id(client_id: Uuid) -> Option<Uuid> {
    let players_to_rooms = ROOMS_STATE.get().read().unwrap().players_to_rooms.clone();
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
