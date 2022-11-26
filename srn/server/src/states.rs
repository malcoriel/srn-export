use core::slice::IterMut;
use std::collections::HashMap;
use std::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard};

use crate::api_struct::{Room, RoomId, RoomsState};
use crate::indexing::{find_and_extract_ship, GameStateCaches};
use crate::world::{spawn_ship, GameMode, Player, ShipTemplate};
use uuid::Uuid;

use crate::rooms_api::{
    find_room_by_id_mut, find_room_by_player_id_mut, find_room_state_id_by_player_id,
    find_room_state_id_by_player_id_mut, find_room_state_id_by_room_id_mut, reindex_rooms,
};
use crate::world::GameState;
use crate::xcast::XCast;
use crate::{get_prng, new_id, notifications, system_gen, world};
use lazy_static::lazy_static;
use lockfree::map::Map as LockFreeMap;
use std::slice::Iter;

lazy_static! {
    pub static ref STATE: RwLock<StateContainer> = {
        RwLock::new(StateContainer {
            rooms: RoomsState::new(),
        })
    };
}

lazy_static! {
    pub static ref ROOMS_READ: LockFreeMap<Uuid, Room> = LockFreeMap::new();
}

#[derive(Serialize)]
pub struct RoomHeader {
    pub id: RoomId,
    pub name: String,
}

pub struct StateContainer {
    pub rooms: RoomsState,
}

pub fn select_state_mut<'a>(
    state_cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> Option<&'a mut GameState> {
    return select_mut_state_v2(state_cont, player_id);
}

// second return value is a clone, not a room that can be edited
pub fn select_room_mut<'a>(
    cont_st: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> Option<&'a mut Room> {
    return find_room_by_player_id_mut(cont_st, player_id);
}

pub fn get_rooms_iter<'a>(cont: &'a RwLockWriteGuard<StateContainer>) -> Iter<'a, Room> {
    return cont.rooms.values.iter();
}

pub fn get_rooms_iter_mut<'a>(cont: &'a mut RwLockWriteGuard<StateContainer>) -> IterMut<'a, Room> {
    return cont.rooms.values.iter_mut();
}

pub fn get_rooms_iter_read<'a>(cont: &'a RwLockReadGuard<StateContainer>) -> Iter<'a, Room> {
    return cont.rooms.values.iter();
}

pub fn update_rooms(cont: &mut RwLockWriteGuard<StateContainer>, val: Vec<Room>) {
    cont.rooms.values = val;
    reindex_rooms(&mut cont.rooms);
}

pub fn add_room(cont: &mut RwLockWriteGuard<StateContainer>, room: Room) {
    cont.rooms.values.push(room);
    reindex_rooms(&mut cont.rooms);
}

pub fn select_state<'a, 'b>(
    state_cont: &'a RwLockReadGuard<StateContainer>,
    player_id: Uuid,
) -> Option<&'a GameState> {
    return select_state_v2(state_cont, player_id);
}

pub fn select_mut_state_v2<'a, 'b>(
    state_cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> Option<&'a mut GameState> {
    if !state_cont.rooms.idx_by_player_id.contains_key(&player_id) {
        return None;
    }
    return find_room_by_player_id_mut(state_cont, player_id).map(|r| &mut r.state);
}

pub fn select_state_v2<'a, 'b>(
    state_cont: &'a RwLockReadGuard<StateContainer>,
    player_id: Uuid,
) -> Option<&'a GameState> {
    let state_id = get_state_id_cont(state_cont, player_id);
    let room_state_id = find_room_state_id_by_player_id(state_cont, player_id);
    return if room_state_id.is_some() {
        if let Some(state) = state_cont
            .rooms
            .get_state_by_room_id(&room_state_id.unwrap())
        {
            Some(state)
        } else {
            None
        }
    } else {
        if let Some(state_id) = state_id {
            if let Some(state) = state_cont.rooms.get_state_by_room_id(&state_id) {
                Some(state)
            } else {
                None
            }
        } else {
            None
        }
    };
}

pub fn move_player_to_room(client_id: Uuid, room_id: RoomId) {
    let player: Option<Player> = {
        let mut state_cont = STATE.write().unwrap();
        let old_player_state = select_state_mut(&mut state_cont, client_id);
        old_player_state.and_then(|old| {
            old.players
                .iter()
                .position(|p| p.id == client_id)
                .and_then(|player_idx| {
                    // intentionally drop the result as the ship gets erased
                    find_and_extract_ship(old, client_id);
                    Some(old.players.remove(player_idx))
                })
        })
    };

    let prng = &mut get_prng();
    let mut player = player.unwrap_or(Player::new(client_id, &GameMode::Sandbox, prng));

    let new_state_id = {
        let mut cont = STATE.write().unwrap();

        let new_state = {
            let room = find_room_by_id_mut(&mut cont, room_id);
            if room.is_none() {
                err!(format!("attempt to join non-existent room {}", room_id));
                return;
            }
            let room = room.unwrap();
            let new_state = &mut room.state;
            new_state
        };
        player.notifications = notifications::get_new_player_notifications(&new_state.mode, prng);
        new_state.players.push(player);
        spawn_ship(new_state, Some(client_id), ShipTemplate::player(None), prng);
        new_state.id
    };
    {
        let mut cont = STATE.write().unwrap();
        reindex_rooms(&mut cont.rooms);
    }

    crate::main_ws_server::notify_state_changed(new_state_id, client_id);
}

pub fn get_state_id_cont(
    state_cont: &RwLockReadGuard<StateContainer>,
    client_id: Uuid,
) -> Option<Uuid> {
    return find_room_state_id_by_player_id(state_cont, client_id);
}

pub fn get_state_id_cont_mut(
    state_cont: &RwLockWriteGuard<StateContainer>,
    client_id: Uuid,
) -> Option<Uuid> {
    return find_room_state_id_by_player_id_mut(state_cont, client_id);
}

pub fn select_state_by_id<'a>(
    cont: &'a RwLockReadGuard<StateContainer>,
    state_id: Uuid,
) -> Option<&'a GameState> {
    return cont.rooms.get_state_by_room_id(&state_id);
}

pub fn select_state_by_id_mut<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    state_id: Uuid,
) -> Option<&'a mut GameState> {
    return cont.rooms.get_state_by_state_id_mut(&state_id);
}
