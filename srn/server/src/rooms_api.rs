use std::sync::RwLock;

use rocket::http::Status;
use rocket::response::Responder;
use rocket::Request;
use rocket_contrib::json::Json;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use state::Storage;

use crate::api_struct::*;

pub static ROOMS_STATE: Storage<RwLock<RoomsState>> = Storage::new();

pub fn init() {
    ROOMS_STATE.set(RwLock::new(RoomsState::new()));
}

#[get("/")]
pub fn get_rooms() -> Json<Vec<Room>> {
    Json(vec![])
}

#[post("/<room_id>/join")]
pub fn join_room(room_id: String) -> Status {
    let id = Uuid::parse_str(room_id.as_str());
    if id.is_err() {
        return Status::BadRequest;
    }
    return Status::Ok;
}

#[post("/<game_mode>/create")]
pub fn create_room(game_mode: String) -> Status {
    let mode = serde_json::from_str::<crate::world::GameMode>(game_mode.as_str());
    if mode.is_err() {
        return Status::BadRequest;
    }
    return Status::Ok;
}

pub fn find_room_state(client_id: Uuid) -> Option<Uuid> {
    let players_to_rooms = ROOMS_STATE.get().read().unwrap().players_to_rooms.clone();
    players_to_rooms.get(&client_id).map(|id| id.clone())
}
