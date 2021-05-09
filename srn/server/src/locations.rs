use uuid::Uuid;
use crate::new_id;
use serde_derive::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use crate::world::{GameState, find_my_ship, find_and_extract_ship, Ship, find_my_ship_index};

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
pub struct LocationChangePayload {
    pub id: Uuid
}


pub fn try_move_player_ship(state: &mut GameState, player_id: Uuid, location_id: Uuid) -> bool {
    if !can_be_moved_player(state, player_id, location_id) {
        return false;
    }
    let ship = find_and_extract_ship(state, player_id);
    let location = state.locations.iter_mut().find(|l| l.id == location_id);
    return if let (Some(location), Some(ship)) = (location, ship) {
        log!(format!("ship {} moved to location {}", ship.id, location_id));
        location.ships.push(ship);
        true
    } else {
        false
    }
}

pub fn can_be_moved_player(state: &mut GameState, player_id: Uuid, _location_id: Uuid) -> bool {
    let ship_idx = find_my_ship_index(state, player_id);
    return if let Some(ship_idx) = ship_idx {
        if state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx].docked_at.is_some() {
            return false;
        }
        let loc = &state.locations[ship_idx.location_idx].adjacent_location_ids;
        loc.iter().any(|l| *l == _location_id)
    } else {
        false
    }
}
