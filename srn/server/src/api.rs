use std::collections::HashMap;
use crate::sandbox::{SAVED_STATES};
use pkg_version::*;
use rocket_contrib::json::Json;

use crate::sandbox::SavedState;
use crate::{select_mut_state};
use crate::system_gen::seed_personal_state;
use crate::world::{seed_state, GameState, gen_state_by_seed, random_hex_seed, GameMode};
use uuid::Uuid;
use std::mem;

const MAJOR: u32 = pkg_version_major!();
const MINOR: u32 = pkg_version_minor!();
const PATCH: u32 = pkg_version_patch!();

#[get("/version")]
pub fn get_version() -> Json<String> {
    let version = format!("{}.{}.{}", MAJOR, MINOR, PATCH);
    Json(version)
}

#[get("/saved_states")]
pub fn get_saved_states() -> Json<Vec<(String, Uuid)>> {
    let states = {
        let lock_guard = SAVED_STATES.lock().unwrap();
        (**lock_guard).clone()
    };
    let mut res = vec![];
    for pair in states.iter() {
        res.push((pair.1.name.clone(), pair.1.state.id));
    }
    Json(res)
}

#[post("/saved_states/save_current/<player_id>/<name>")]
pub fn save_current_state(player_id: String, name: String) {
    let player_id = Uuid::parse_str(player_id.as_str()).expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let mut current = crate::STATE.write().unwrap();
    let state = select_mut_state(&mut current, player_id);
    if state.id != player_id {
        warn!("attempt to save non-personal state");
        return;
    }
    let mut saved = SAVED_STATES.lock().unwrap();

    let cloned = state.clone();
    let id = cloned.id;
    let instance = SavedState {
        state: cloned,
        name: name.clone(),
    };
    saved.insert(id, instance);
}

#[post("/saved_states/load/<player_id>/<state_id>")]
pub fn load_saved_state(player_id: String, state_id: String) {
    let mut current = crate::STATE.write().unwrap();
    let player_id = Uuid::parse_str(player_id.as_str()).expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let state_id = Uuid::parse_str(state_id.as_str()).expect(format!("Bad state_id {}, not a uuid", player_id).as_str());
    let mut saved_cont = SAVED_STATES.lock().unwrap();
    let saved_state = saved_cont.get_mut(&state_id).expect("Requested state does not exist");
    let current_state = select_mut_state(&mut current, Uuid::from_u128(player_id.as_u128()));
    if current_state.id != player_id {
        warn!("attempt to load into non-personal state");
        return;
    }
    let saved_clone = saved_state.state.clone();
    mem::swap(current_state, &mut saved_state.state);
    saved_state.state = saved_clone;
    current_state.id = player_id;
    current_state.players[0].id = player_id;
    current_state.milliseconds_remaining = 99 * 60 * 1000;
}

#[post("/saved_states/load_clean/<player_id>")]
pub fn load_clean_state(player_id: String) {
    let mut current = crate::STATE.write().unwrap();
    let player_id = Uuid::parse_str(player_id.as_str()).expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let current_state = select_mut_state(&mut current, Uuid::from_u128(player_id.as_u128()));
    if current_state.id != player_id {
        warn!("attempt to load into non-personal state");
        return;
    }
    let mut clean_state = seed_personal_state(player_id, &GameMode::Sandbox);
    mem::swap(current_state, &mut clean_state);
}

#[get("/saved_states/json/<player_id>")]
pub fn save_state_into_json(player_id: String) -> Json<Option<GameState>> {
    let mut current = crate::STATE.write().unwrap();
    let player_id = Uuid::parse_str(player_id.as_str()).expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let current_state = select_mut_state(&mut current, Uuid::from_u128(player_id.as_u128()));
    if current_state.id != player_id {
        warn!("attempt to save non-personal state");
        return Json(None);
    }
    Json(Some(current_state.clone()))
}


#[post("/saved_states/load_random/<player_id>")]
pub fn load_random_state(player_id: String) {
    let player_id = Uuid::parse_str(player_id.as_str()).expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let mut current = crate::STATE.write().unwrap();
    let current_state = select_mut_state(&mut current, player_id);
    if current_state.id != player_id {
        warn!("attempt to load into non-personal state");
        return;
    }
    let mut random_state = gen_state_by_seed(true, random_hex_seed());
    let player = current_state.players[0].clone();
    let ship = current_state.ships[0].clone();
    mem::swap(current_state, &mut random_state);
    current_state.id = player.id;
    current_state.players.push(player);
    current_state.ships.push(ship);
    current_state.mode = GameMode::Sandbox;
    current_state.milliseconds_remaining = 99 * 60 * 1000;
}

#[post("/saved_states/load_seeded/<player_id>/<seed>")]
pub fn load_seeded_state(player_id: String, seed: String) {
    let player_id = Uuid::parse_str(player_id.as_str()).expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let mut current = crate::STATE.write().unwrap();
    let current_state = select_mut_state(&mut current, player_id);
    if current_state.id != player_id {
        warn!("attempt to load into non-personal state");
        return;
    }
    let mut random_state = gen_state_by_seed(true, seed);
    let player = current_state.players[0].clone();
    let ship = current_state.ships[0].clone();
    mem::swap(current_state, &mut random_state);
    current_state.id = player.id;
    current_state.players.push(player);
    current_state.ships.push(ship);
    current_state.mode = GameMode::Sandbox;
    current_state.milliseconds_remaining = 99 * 60 * 1000;
}
