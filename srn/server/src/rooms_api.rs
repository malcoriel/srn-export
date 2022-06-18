use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use std::sync::RwLock;
use std::sync::{RwLockReadGuard, RwLockWriteGuard};
use std::thread;
use std::time::Duration;

use crate::world_events::GameEvent;
use chrono::Local;
use rocket::http::Status;
use rocket::response::Responder;
use rocket::Request;
use rocket_contrib::json::Json;
use serde_derive::{Deserialize, Serialize};
use state::Storage;
use uuid::Uuid;

use crate::api_struct::RoomsState;
use crate::api_struct::*;
use crate::server_events::fire_event;
use crate::states::{RoomHeader, StateContainer, ROOMS_READ};
use crate::world::{GameMode, GameState, PlayerId};
use crate::{cargo_rush, get_prng, new_id, system_gen, world};

#[get("/")]
pub fn get_rooms() -> Json<Vec<RoomHeader>> {
    let rooms = crate::ROOMS_READ
        .iter()
        .map(|r| RoomHeader {
            id: r.val().id,
            name: r.val().name.clone(),
        })
        .collect();
    Json(rooms)
}

#[get("/<game_mode>")]
pub fn get_rooms_for_mode(game_mode: String) -> Json<Vec<RoomHeader>> {
    let mode =
        serde_json::from_str::<crate::world::GameMode>(format!("\"{}\"", game_mode).as_str());
    if mode.is_err() {
        return Json(vec![]);
    }

    let mode = mode.unwrap();
    let rooms: Vec<Room> = crate::ROOMS_READ.iter().map(|r| r.val().clone()).collect();
    let rooms = rooms
        .into_iter()
        .filter(|r| r.state.mode == mode)
        .map(|r| RoomHeader {
            id: r.id,
            name: r.name,
        })
        .collect::<Vec<RoomHeader>>();

    Json(rooms)
}

#[post("/create/<game_mode>")]
pub fn create_room(game_mode: String) -> Json<RoomIdResponse> {
    log!("create room");
    let mode =
        serde_json::from_str::<crate::world::GameMode>(format!("\"{}\"", game_mode).as_str());
    if mode.is_err() {
        return Json(RoomIdResponse {
            room_id: Uuid::default(),
        });
    }
    let mode = mode.ok().unwrap();
    let room_id = new_id();
    fire_event(GameEvent::CreateRoomRequest {
        mode,
        room_id,
        bots_seed: None,
    });

    return Json(RoomIdResponse { room_id });
}

pub fn create_room_impl(
    cont: &mut RwLockWriteGuard<StateContainer>,
    mode: &GameMode,
    room_id: Uuid,
    bots_seed: Option<String>,
) {
    let (state_id, room) = world::make_room(&mode, room_id, &mut get_prng(), bots_seed, None, None);
    let bot_len = room.bots.len();
    cont.rooms.values.push(room);
    log!(format!(
        "created room {} with state {} for mode {} and {} bots",
        room_id, state_id, mode, bot_len
    ));
    reindex_rooms(&mut cont.rooms);
}

pub fn find_room_state_id_by_player_id(
    cont: &RwLockReadGuard<StateContainer>,
    client_id: Uuid,
) -> Option<Uuid> {
    cont.rooms
        .state_id_by_player_id
        .get(&client_id)
        .map(|id| id.clone())
}

pub fn find_room_state_id_by_player_id_mut(
    cont: &RwLockWriteGuard<StateContainer>,
    client_id: Uuid,
) -> Option<Uuid> {
    cont.rooms
        .state_id_by_player_id
        .get(&client_id)
        .map(|id| id.clone())
}

pub fn find_room_state_id_by_room_id_mut(
    cont: &mut RwLockWriteGuard<StateContainer>,
    room_id: RoomId,
) -> Option<Uuid> {
    cont.rooms
        .state_id_by_room_id
        .get(&room_id)
        .map(|id| id.clone())
}

pub fn find_room_by_id_mut<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    room_id: RoomId,
) -> Option<&'a mut Room> {
    cont.rooms
        .idx_by_room_id
        .get(&room_id)
        .map(|idx| idx.clone())
        .and_then(move |idx| cont.rooms.values.get_mut(idx))
}

pub fn find_room_by_player_id_mut<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: PlayerId,
) -> Option<&'a mut Room> {
    cont.rooms
        .idx_by_player_id
        .get(&player_id)
        .map(|idx| idx.clone())
        .and_then(move |idx| cont.rooms.values.get_mut(idx))
}

pub const ROOM_CLEANUP_NO_PLAYERS_TIMEOUT_MS: i64 = 10 * 1000;

pub fn cleanup_empty_rooms(cont: &mut RwLockWriteGuard<StateContainer>) {
    let curr_millis = Local::now().timestamp_millis();
    for room in cont.rooms.values.iter_mut() {
        if room.last_players_mark.is_none() && room.state.players.len() == room.bots.len() {
            room.last_players_mark = Some(curr_millis);
        } else if room.last_players_mark.is_some() && room.state.players.len() > room.bots.len() {
            room.last_players_mark = None;
        }
    }
    let to_drop: HashSet<RoomId> = HashSet::from_iter(
        cont.rooms
            .values
            .iter()
            .filter_map(|room| {
                room.last_players_mark.map_or(None, |mark| {
                    if (mark - curr_millis).abs() > ROOM_CLEANUP_NO_PLAYERS_TIMEOUT_MS {
                        Some(room.id)
                    } else {
                        None
                    }
                })
            })
            .collect::<Vec<Uuid>>()
            .into_iter(),
    );
    cont.rooms.values.retain(|r| {
        let keep = !to_drop.contains(&r.id);
        if !keep {
            log!(format!(
                "dropping room {} of mode {} without players after {}ms",
                r.id, r.state.mode, ROOM_CLEANUP_NO_PLAYERS_TIMEOUT_MS
            ));
        }
        keep
    });
    reindex_rooms(&mut cont.rooms);
}

pub fn reindex_rooms(state: &mut RoomsState) {
    let ids: Vec<Uuid> = ROOMS_READ.iter().map(|g| g.key().clone()).collect();
    for id in ids.into_iter() {
        ROOMS_READ.remove(&id);
    }
    for i in 0..state.values.len() {
        let room = state.values.get(i).unwrap();
        ROOMS_READ.insert(room.id, room.clone());
        for player in room.state.players.iter() {
            state.state_id_by_player_id.insert(player.id, room.state.id);
            state.idx_by_player_id.insert(player.id, i);
        }
        state.state_id_by_room_id.insert(room.id, room.state.id);
        state.idx_by_room_id.insert(room.id, i);
        state.idx_by_state_id.insert(room.state.id, i);
    }
}
