use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::indexing::{find_and_extract_ship, find_my_ship, find_player_ship_index};
use crate::new_id;
use crate::world::{GameState, Ship};

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
pub struct LocationChangePayload {
    pub id: Uuid,
}

pub fn try_move_player_ship(state: &mut GameState, player_id: Uuid, location_id: Uuid) -> bool {
    if !can_be_moved_player(state, player_id, location_id) {
        return false;
    }
    let ship = find_and_extract_ship(state, player_id);
    let location = state.locations.iter_mut().find(|l| l.id == location_id);
    return if let (Some(location), Some(ship)) = (location, ship) {
        location.ships.push(ship);
        true
    } else {
        false
    };
}

pub fn can_be_moved_player(state: &mut GameState, player_id: Uuid, _location_id: Uuid) -> bool {
    let ship_idx = find_player_ship_index(state, player_id);
    return if let Some(ship_idx) = ship_idx {
        if state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx]
            .docked_at
            .is_some()
        {
            return false;
        }
        let loc = &state.locations[ship_idx.location_idx].adjacent_location_ids;
        loc.iter().any(|l| *l == _location_id)
    } else {
        false
    };
}
