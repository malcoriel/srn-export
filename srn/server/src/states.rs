use std::collections::HashMap;
use std::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard};

use crate::api_struct::{Room, RoomId, RoomsState};
use crate::indexing::find_and_extract_ship;
use crate::world::{spawn_ship, GameMode, Player};
use uuid::Uuid;

use crate::rooms_api::{
    find_room_by_id_mut, find_room_by_player_id_mut, find_room_state_id_by_player_id,
    find_room_state_id_by_player_id_mut, find_room_state_id_by_room_id_mut,
};
use crate::world::GameState;
use crate::xcast::XCast;
use crate::{new_id, system_gen, world};
use lazy_static::lazy_static;
use std::slice::Iter;

lazy_static! {
    pub static ref STATE: RwLock<StateContainer> = {
        let mut state = world::seed_state(true, true);
        state.mode = world::GameMode::CargoRush;
        RwLock::new(StateContainer {
            state,
            rooms: RoomsState::new(),
        })
    };
}

pub struct StateContainer {
    pub state: GameState,
    pub rooms: RoomsState,
}

pub fn select_state_mut<'a>(
    state_cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    return select_mut_state_v2(state_cont, player_id);
}

// second return value is a clone, not a room that can be edited
pub fn select_room_mut<'a>(
    cont_st: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> Option<&'a mut Room> {
    return find_room_by_player_id_mut(cont_st, player_id);
}

pub fn select_default_state<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
) -> &'a mut GameState {
    return &mut cont.state;
}

pub fn select_default_state_read<'a>(cont: &'a RwLockReadGuard<StateContainer>) -> &'a GameState {
    return &cont.state;
}

pub fn update_default_state(cont: &mut RwLockWriteGuard<StateContainer>, val: GameState) {
    cont.state = val;
}

pub fn get_rooms_iter<'a>(cont: &'a RwLockWriteGuard<StateContainer>) -> Iter<'a, Room> {
    return cont.rooms.values.iter();
}

pub fn get_rooms_iter_read<'a>(cont: &'a RwLockReadGuard<StateContainer>) -> Iter<'a, Room> {
    return cont.rooms.values.iter();
}

pub fn update_rooms(cont: &mut RwLockWriteGuard<StateContainer>, val: Vec<Room>) {
    cont.rooms.values = val;
    cont.rooms.reindex();
}

pub fn add_room(cont: &mut RwLockWriteGuard<StateContainer>, room: Room) {
    cont.rooms.values.push(room);
    cont.rooms.reindex();
}

pub fn select_state<'a, 'b>(
    state_cont: &'a RwLockReadGuard<StateContainer>,
    player_id: Uuid,
) -> &'a GameState {
    return select_state_v2(state_cont, player_id);
}

pub fn select_mut_state_v1<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    if cont.rooms.idx_by_id.contains_key(&player_id) {
        cont.rooms.get_state_by_id_mut(&player_id).unwrap()
    } else {
        &mut cont.state
    }
}

pub fn select_mut_state_v2<'a, 'b>(
    state_cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    if !state_cont.rooms.idx_by_player_id.contains_key(&player_id) {
        return &mut state_cont.state;
    }
    let room = find_room_by_player_id_mut(state_cont, player_id).unwrap();
    return &mut room.state;
}

pub fn select_state_v2<'a, 'b>(
    state_cont: &'a RwLockReadGuard<StateContainer>,
    player_id: Uuid,
) -> &'a GameState {
    let state_id = get_state_id_cont(state_cont, player_id);
    let room_state_id = find_room_state_id_by_player_id(state_cont, player_id);
    return if state_id == state_cont.state.id {
        &state_cont.state
    } else if room_state_id.is_some() {
        if let Some(state) = state_cont.rooms.get_state_by_id(&room_state_id.unwrap()) {
            state
        } else {
            &state_cont.state
        }
    } else {
        if let Some(state) = state_cont.rooms.get_state_by_id(&state_id) {
            state
        } else {
            &state_cont.state
        }
    };
}

pub fn move_player_to_room(client_id: Uuid, room_id: RoomId) {
    let player = {
        let mut state_cont = STATE.write().unwrap();
        let old_player_state = select_state_mut(&mut state_cont, client_id);
        old_player_state
            .players
            .iter()
            .position(|p| p.id == client_id)
            .map(|player_idx| {
                // intentionally drop the result as the ship gets erased
                find_and_extract_ship(old_player_state, client_id);
                old_player_state.players.remove(player_idx)
            })
    };

    let mut player = player.unwrap_or(Player::new(client_id, &GameMode::Sandbox));
    player.notifications = vec![];

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
        new_state.players.push(player);
        spawn_ship(new_state, client_id, None);
        new_state.id
    };

    crate::main_ws_server::notify_state_changed(new_state_id, client_id);
}

pub fn get_state_id_cont(state_cont: &RwLockReadGuard<StateContainer>, client_id: Uuid) -> Uuid {
    let in_personal = state_cont.rooms.idx_by_id.contains_key(&client_id);
    let room_state = find_room_state_id_by_player_id(state_cont, client_id);
    return if in_personal {
        client_id
    } else if room_state.is_some() {
        room_state.unwrap()
    } else {
        state_cont.state.id.clone()
    };
}

pub fn get_state_id_cont_mut(
    state_cont: &RwLockWriteGuard<StateContainer>,
    client_id: Uuid,
) -> Uuid {
    let in_personal = state_cont.rooms.idx_by_id.contains_key(&client_id);
    let room_state = find_room_state_id_by_player_id_mut(state_cont, client_id);
    return if in_personal {
        client_id
    } else if room_state.is_some() {
        room_state.unwrap()
    } else {
        state_cont.state.id.clone()
    };
}

pub fn select_state_by_id<'a>(
    cont: &'a RwLockReadGuard<StateContainer>,
    state_id: Uuid,
) -> Option<&'a GameState> {
    if cont.state.id == state_id {
        return Some(&cont.state);
    }
    return cont.rooms.get_state_by_id(&state_id);
}

pub fn select_state_by_id_mut<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    state_id: Uuid,
) -> Option<&'a mut GameState> {
    if cont.state.id == state_id {
        return Some(&mut cont.state);
    }
    return cont.rooms.get_state_by_id_mut(&state_id);
}
