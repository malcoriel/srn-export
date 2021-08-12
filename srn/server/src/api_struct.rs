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
    pub rooms: Vec<Room>,
    pub players_to_state_ids: HashMap<PlayerId, RoomId>,
    pub rooms_states_by_id: HashMap<RoomId, Uuid>,
    pub rooms_index_by_id: HashMap<RoomId, usize>,
}

impl RoomsState {
    pub fn new() -> Self {
        RoomsState {
            rooms: vec![],
            players_to_state_ids: HashMap::new(),
            rooms_states_by_id: HashMap::new(),
            rooms_index_by_id: HashMap::new(),
        }
    }
    pub fn reindex(&mut self) {
        let rooms_clone = self.rooms.clone();
        for i in 0..rooms_clone.len() {
            let room = rooms_clone.get(i).unwrap();
            for client in room.clients.iter() {
                self.players_to_state_ids
                    .entry(client.client_id)
                    .or_insert(room.state_id);
            }
            self.rooms_states_by_id
                .entry(room.id)
                .or_insert(room.state_id);
            self.rooms_index_by_id.entry(room.id).or_insert(i);
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
