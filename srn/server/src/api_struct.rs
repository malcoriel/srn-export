use crate::world::{GameMode, PlayerId};
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct ClientMarker {
    name: String,
    client_id: Uuid,
}

pub type RoomId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct RoomsState {
    pub rooms: Vec<Room>,
    pub players_to_rooms: HashMap<PlayerId, RoomId>,
}

impl RoomsState {
    pub fn new() -> Self {
        RoomsState {
            rooms: vec![],
            players_to_rooms: HashMap::new(),
        }
    }
    pub fn reindex(&mut self) {
        for room in self.rooms.clone() {
            for client in room.clients {
                self.players_to_rooms
                    .entry(client.client_id)
                    .or_insert(room.id);
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TypescriptDefinition, TypeScriptify)]
pub struct Room {
    pub id: RoomId,
    pub name: String,
    pub state_id: Uuid,
    pub mode: GameMode,
    pub clients: Vec<ClientMarker>,
    pub max_players: u32,
}
