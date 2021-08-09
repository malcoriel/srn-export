use crate::world::GameState;
use std::collections::HashMap;
use std::sync::{RwLockReadGuard, RwLockWriteGuard};
use uuid::Uuid;

use crate::rooms_api::find_room_state;

pub struct StateContainer {
    pub states: HashMap<Uuid, GameState>,
    pub state: GameState,
}

pub fn select_mut_state<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    return select_mut_state_v2(cont, player_id);
}

pub fn select_state<'a>(
    cont: &'a RwLockReadGuard<StateContainer>,
    player_id: Uuid,
) -> &'a GameState {
    return select_state_v2(cont, player_id);
}

pub fn select_mut_state_v1<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    if cont.states.contains_key(&player_id) {
        cont.states.get_mut(&player_id).unwrap()
    } else {
        &mut cont.state
    }
}

pub fn select_mut_state_v2<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    let state_id = crate::get_state_id_cont_mut(cont, player_id);
    let room_state_id = find_room_state(player_id);
    return if state_id == cont.state.id {
        &mut cont.state
    } else if room_state_id.is_some() {
        cont.states.get_mut(&room_state_id.unwrap()).unwrap()
    } else {
        cont.states.get_mut(&state_id).unwrap()
    };
}

pub fn select_state_v2<'a>(
    cont: &'a RwLockReadGuard<StateContainer>,
    player_id: Uuid,
) -> &'a GameState {
    let state_id = crate::get_state_id_cont(cont, player_id);
    let room_state_id = find_room_state(player_id);
    return if state_id == cont.state.id {
        &cont.state
    } else if room_state_id.is_some() {
        cont.states.get(&room_state_id.unwrap()).unwrap()
    } else {
        cont.states.get(&state_id).unwrap()
    };
}
