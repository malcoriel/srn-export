use std::collections::HashMap;
use std::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard};

use uuid::Uuid;

use crate::indexing::find_and_extract_ship;
use crate::world::{spawn_ship, GameMode};

use crate::rooms_api::find_room_state;
use crate::world::GameState;
use crate::xcast::XCast;
use crate::{system_gen, world};
use lazy_static::lazy_static;
use std::collections::hash_map::Iter;

lazy_static! {
    pub static ref STATE: RwLock<StateContainer> = {
        let mut state = world::seed_state(true, true);
        state.mode = world::GameMode::CargoRush;
        let states = HashMap::new();
        RwLock::new(StateContainer {
            states: states,
            state,
        })
    };
}

pub struct StateContainer {
    states: HashMap<Uuid, GameState>,
    state: GameState,
}

pub fn select_mut_state<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    player_id: Uuid,
) -> &'a mut GameState {
    return select_mut_state_v2(cont, player_id);
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

pub fn get_states_iter<'a>(
    cont: &'a RwLockWriteGuard<StateContainer>,
) -> Iter<'a, Uuid, GameState> {
    return cont.states.iter();
}

pub fn get_states_iter_read<'a>(
    cont: &'a RwLockReadGuard<StateContainer>,
) -> Iter<'a, Uuid, GameState> {
    return cont.states.iter();
}

pub fn update_states(cont: &mut RwLockWriteGuard<StateContainer>, val: HashMap<Uuid, GameState>) {
    cont.states = val;
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
    let state_id = get_state_id_cont_mut(cont, player_id);
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
    let state_id = get_state_id_cont(cont, player_id);
    let room_state_id = find_room_state(player_id);
    return if state_id == cont.state.id {
        &cont.state
    } else if room_state_id.is_some() {
        cont.states.get(&room_state_id.unwrap()).unwrap()
    } else {
        cont.states.get(&state_id).unwrap()
    };
}

pub fn move_player_to_personal_room(client_id: Uuid, mode: GameMode) {
    let mut cont = STATE.write().unwrap();
    let player_idx = cont
        .state
        .players
        .iter()
        .position(|p| p.id == client_id)
        .unwrap();
    {
        find_and_extract_ship(&mut cont.state, client_id);
    }
    let mut player = cont.state.players.remove(player_idx);
    player.notifications = vec![];
    let personal_state = cont
        .states
        .entry(client_id)
        .or_insert(system_gen::seed_personal_state(client_id, &mode));
    personal_state.players.push(player);

    {
        spawn_ship(personal_state, client_id, None);
    }
    // the state id filtering will take care of filtering the receivers
    let state = personal_state.clone();
    let state_id = state.id.clone();
    crate::main_ws_server::x_cast_state(state, XCast::Broadcast(state_id));
    crate::main_ws_server::notify_state_changed(personal_state.id, client_id);
}

pub fn get_state_id_cont(cont: &RwLockReadGuard<StateContainer>, client_id: Uuid) -> Uuid {
    let in_personal = cont.states.contains_key(&client_id);
    let room_state = find_room_state(client_id);
    return if in_personal {
        client_id
    } else if room_state.is_some() {
        room_state.unwrap()
    } else {
        cont.state.id.clone()
    };
}

pub fn get_state_id_cont_mut(cont: &RwLockWriteGuard<StateContainer>, client_id: Uuid) -> Uuid {
    let in_personal = cont.states.contains_key(&client_id);
    let room_state = find_room_state(client_id);
    return if in_personal {
        client_id
    } else if room_state.is_some() {
        room_state.unwrap()
    } else {
        cont.state.id.clone()
    };
}

pub fn select_state_by_id<'a>(
    cont: &'a RwLockReadGuard<StateContainer>,
    state_id: Uuid,
) -> Option<&'a GameState> {
    if cont.state.id == state_id {
        return Some(&cont.state);
    }
    return cont.states.get(&state_id);
}

pub fn select_state_by_id_mut<'a>(
    cont: &'a mut RwLockWriteGuard<StateContainer>,
    state_id: Uuid,
) -> Option<&'a mut GameState> {
    if cont.state.id == state_id {
        return Some(&mut cont.state);
    }
    return cont.states.get_mut(&state_id);
}
