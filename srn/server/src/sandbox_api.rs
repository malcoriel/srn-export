use std::collections::HashMap;
use std::mem;

use rocket::http::Status;
use rocket_contrib::json::Json;
use uuid::Uuid;

use crate::market::init_all_planets_market;
use crate::sandbox::SavedState;
use crate::sandbox::SAVED_STATES;
use crate::states::{select_room_mut, select_state_mut};
use crate::system_gen::seed_room_state;
use crate::world::{gen_state_by_seed, random_hex_seed, seed_state, GameMode, GameState};

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
    let player_id = Uuid::parse_str(player_id.as_str())
        .expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let mut current = crate::STATE.write().unwrap();
    let state = select_state_mut(&mut current, player_id);
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
    let player_id = Uuid::parse_str(player_id.as_str())
        .expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let state_id = Uuid::parse_str(state_id.as_str())
        .expect(format!("Bad state_id {}, not a uuid", player_id).as_str());
    let mut saved_cont = SAVED_STATES.lock().unwrap();
    let saved_state = saved_cont
        .get_mut(&state_id)
        .expect("Requested state does not exist")
        .clone();
    replace_player_state(player_id, saved_state.state)
}

#[post("/saved_states/load_clean/<player_id>")]
pub fn load_clean_state(player_id: String) {
    let mut current = crate::STATE.write().unwrap();
    let player_id = Uuid::parse_str(player_id.as_str())
        .expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let current_state = select_state_mut(&mut current, Uuid::from_u128(player_id.as_u128()));
    if current_state.id != player_id {
        warn!("attempt to load into non-personal state");
        return;
    }
    let mut clean_state = seed_room_state(&GameMode::Sandbox, "clean".to_string());
    mem::swap(current_state, &mut clean_state);
}

#[get("/saved_states/json/<player_id>")]
pub fn save_state_into_json(player_id: String) -> Json<Option<GameState>> {
    let mut cont = crate::STATE.write().unwrap();
    let player_id = Uuid::parse_str(player_id.as_str())
        .expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    let current_state = select_state_mut(&mut cont, player_id);
    Json(Some(current_state.clone()))
}

#[post("/saved_states/load_random/<player_id>")]
pub fn load_random_state(player_id: String) {
    {
        let player_id = Uuid::parse_str(player_id.as_str())
            .expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
        replace_player_state(player_id, gen_state_by_seed(true, random_hex_seed()));
    }
}

fn replace_player_state(player_id: Uuid, mut new_state: GameState) {
    let mut state_cont = crate::STATE.write().unwrap();
    {
        let room = select_room_mut(&mut state_cont, player_id);
        if room.is_none() {
            warn!("attempt to load state for non-existent room");
            return;
        }
        let room = room.unwrap();
        let owner_id = room.state.players.get(0);
        if owner_id.map_or(Uuid::default(), |o| o.id) != player_id {
            warn!("attempt to load into non-owned room's state (first player = owner)");
            return;
        }
        init_all_planets_market(&mut new_state);
        let player = room.state.players[0].clone();
        let ship = room.state.locations[0].ships[0].clone();
        room.state = new_state;
        room.state.players.push(player);
        room.state.mode = GameMode::Sandbox;
        room.state.milliseconds_remaining = 99 * 60 * 1000;
        let loc = &mut room.state.locations[0];
        loc.ships.push(ship);
    }
    state_cont.rooms.reindex();
}

#[post("/saved_states/load_seeded/<player_id>/<seed>")]
pub fn load_seeded_state(player_id: String, seed: String) {
    let player_id = Uuid::parse_str(player_id.as_str())
        .expect(format!("Bad player_id {}, not a uuid", player_id).as_str());
    replace_player_state(player_id, gen_state_by_seed(true, seed));
}
