use std::collections::HashMap;
use std::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard};

use crate::api_struct::RoomId;
use crate::indexing::find_and_extract_ship;
use crate::world::{spawn_ship, GameMode, Player};
use uuid::Uuid;

use crate::rooms_api::{
    find_room_state_id_by_player_id, find_room_state_id_by_room_id, try_add_client_to_room,
    ROOMS_STATE,
};
use crate::world::GameState;
use crate::xcast::XCast;
use crate::{new_id, system_gen, world};
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

pub fn select_state_mut<'a>(
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

pub fn add_state(cont: &mut RwLockWriteGuard<StateContainer>, state: GameState) {
    eprintln!("adding state id {}", state.id);
    cont.states.insert(state.id, state);
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
    let room_state_id = find_room_state_id_by_player_id(player_id);
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
    let room_state_id = find_room_state_id_by_player_id(player_id);
    return if state_id == cont.state.id {
        &cont.state
    } else if room_state_id.is_some() {
        cont.states.get(&room_state_id.unwrap()).unwrap()
    } else {
        cont.states.get(&state_id).unwrap()
    };
}

pub fn move_player_to_room(client_id: Uuid, room_id: RoomId, client_name: String) {
    let player = {
        let mut cont = STATE.write().unwrap();
        let old_player_state = select_state_mut(&mut cont, client_id);
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

    let mut player = player.unwrap_or(Player::new(new_id(), &GameMode::Sandbox));
    player.notifications = vec![];
    let mut cont = STATE.write().unwrap();

    let new_state = {
        let state_id = find_room_state_id_by_room_id(room_id);
        if state_id.is_none() {
            err!(format!("attempt to join non-existent room {}", room_id));
            return;
        }
        let state_id = state_id.unwrap();
        let new_state = select_state_by_id_mut(&mut cont, state_id);
        if new_state.is_none() {
            err!(format!(
                "attempt to join room {} with non-existent state {}",
                room_id, state_id
            ));
            return;
        }
        new_state.unwrap()
    };
    let player_id = player.id.clone();
    new_state.players.push(player);
    spawn_ship(new_state, client_id, None);
    // the broadcast will take care of actually delivering the state, as long as we update the rooms
    try_add_client_to_room(player_id, room_id, client_name);

    // let state = new_state.clone();
    // let state_id = state.id.clone();
    // crate::main_ws_server::x_cast_state(state, XCast::Broadcast(state_id));
    crate::main_ws_server::notify_state_changed(new_state.id, client_id);
}

pub fn get_state_id_cont(cont: &RwLockReadGuard<StateContainer>, client_id: Uuid) -> Uuid {
    let in_personal = cont.states.contains_key(&client_id);
    let room_state = find_room_state_id_by_player_id(client_id);
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
    let room_state = find_room_state_id_by_player_id(client_id);
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
    eprintln!("selecting state {}", state_id);
    let keys = cont
        .states
        .keys()
        .map(|k| format!("{}", k.clone()))
        .collect::<Vec<_>>();
    eprintln!("current keys {}", keys.join(", "));
    return cont.states.get_mut(&state_id);
}
