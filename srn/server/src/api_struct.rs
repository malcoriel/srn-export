use crate::world::{GameMode, GameState, PlayerId};
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct ClientMarker {
    pub name: String,
    pub client_id: Uuid,
}

pub type RoomId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct RoomsState {
    pub values: Vec<Room>,
    pub state_id_by_player_id: HashMap<PlayerId, RoomId>,
    pub state_id_by_id: HashMap<RoomId, Uuid>,
    pub idx_by_id: HashMap<RoomId, usize>,
    pub idx_by_player_id: HashMap<PlayerId, usize>,
}

impl RoomsState {
    pub fn new() -> Self {
        RoomsState {
            values: vec![],
            state_id_by_player_id: HashMap::new(),
            state_id_by_id: HashMap::new(),
            idx_by_id: HashMap::new(),
            idx_by_player_id: HashMap::new(),
        }
    }

    pub fn get_state_by_id_mut(&mut self, id: &Uuid) -> Option<&mut GameState> {
        self.idx_by_id
            .get(id)
            .map(|idx| idx.clone())
            .and_then(move |idx| self.values.get_mut(idx))
            .and_then(|r| Some(&mut r.state))
    }

    pub fn get_state_by_id(&self, id: &Uuid) -> Option<&GameState> {
        self.idx_by_id
            .get(id)
            .map(|idx| idx.clone())
            .and_then(move |idx| self.values.get(idx))
            .and_then(|r| Some(&r.state))
    }

    pub fn reindex(&mut self) {
        let rooms_clone = self.values.clone();
        for i in 0..rooms_clone.len() {
            let room = rooms_clone.get(i).unwrap();
            for player in room.state.players.iter() {
                self.state_id_by_player_id.insert(player.id, room.state.id);
                self.idx_by_player_id.insert(player.id, i);
            }
            self.state_id_by_id.insert(room.id, room.state.id);
            self.idx_by_id.insert(room.id, i);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct RoomIdResponse {
    pub room_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct Room {
    pub id: RoomId,
    pub name: String,
    pub state: GameState,
}
