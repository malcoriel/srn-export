use crate::world::{GameMode, PlayerId};
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
    pub fn reindex(&mut self) {
        let rooms_clone = self.values.clone();
        for i in 0..rooms_clone.len() {
            let room = rooms_clone.get(i).unwrap();
            for client in room.clients.iter() {
                self.state_id_by_player_id
                    .entry(client.client_id)
                    .or_insert(room.state_id);
                self.idx_by_player_id.entry(client.client_id).or_insert(i);
            }
            self.state_id_by_id.entry(room.id).or_insert(room.state_id);
            self.idx_by_id.entry(room.id).or_insert(i);
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
    pub state_id: Uuid,
    pub mode: GameMode,
    pub clients: Vec<ClientMarker>,
}
