use uuid::Uuid;
use crate::new_id;
use serde_derive::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use crate::world::{GameState, find_my_ship, find_and_extract_ship, Ship};

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
pub struct LocationChangePayload {
    pub id: Uuid
}


pub fn try_move_player_ship(state: &mut GameState, player_id: Uuid, location_id: Uuid) -> bool {
    let ship = find_and_extract_ship(state, player_id);

    if !can_be_moved(state, ship.clone(), location_id) {
        return false;
    }
    let location = state.locations.iter_mut().find(|l| l.id == location_id);
    return if let (Some(location), Some(ship)) = (location, ship) {
        log!(format!("ship {} moved to location {}", ship.id, location_id));
        location.ships.push(ship);
        true
    } else {
        false
    }
}

pub fn can_be_moved(_state: &mut GameState, _ship: Option<Ship>, _location_id: Uuid) -> bool {
    return true;
}

pub fn can_be_moved_player(_state: &mut GameState, _player_id: Uuid, _location_id: Uuid) -> bool {
    return true;
}
