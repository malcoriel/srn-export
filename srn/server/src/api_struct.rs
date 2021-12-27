use std::collections::{HashMap, HashSet};

use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::world::{GameMode, GameState, PlayerId};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub enum AiTrait {
    Unknown,
    ImmediatePlanetLand,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Bot {
    pub id: Uuid,
    pub traits: Vec<AiTrait>,
    pub timer: Option<i64>,
}

pub fn new_bot(traits: Option<Vec<AiTrait>>) -> Bot {
    Bot {
        id: crate::new_id(),
        traits: traits.unwrap_or(vec![]),
        timer: Some(0),
    }
}

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
    pub state_id_by_room_id: HashMap<RoomId, Uuid>,
    pub idx_by_state_id: HashMap<RoomId, usize>,
    pub idx_by_room_id: HashMap<RoomId, usize>,
    pub idx_by_player_id: HashMap<PlayerId, usize>,
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
    pub dialogue_states: crate::dialogue::DialogueStates,
    pub last_players_mark: Option<i64>,
    pub bots: Vec<Bot>,
}

impl RoomsState {
    pub fn new() -> Self {
        RoomsState {
            values: vec![],
            state_id_by_player_id: HashMap::new(),
            state_id_by_room_id: HashMap::new(),
            idx_by_state_id: HashMap::new(),
            idx_by_room_id: HashMap::new(),
            idx_by_player_id: HashMap::new(),
        }
    }

    pub fn get_state_by_room_id_mut(&mut self, id: &Uuid) -> Option<&mut GameState> {
        self.idx_by_room_id
            .get(id)
            .map(|idx| idx.clone())
            .and_then(move |idx| self.values.get_mut(idx))
            .and_then(|r| Some(&mut r.state))
    }

    pub fn get_state_by_room_id(&self, id: &Uuid) -> Option<&GameState> {
        self.idx_by_room_id
            .get(id)
            .map(|idx| idx.clone())
            .and_then(move |idx| self.values.get(idx))
            .and_then(|r| Some(&r.state))
    }

    pub fn get_state_by_state_id_mut(&mut self, id: &Uuid) -> Option<&mut GameState> {
        self.idx_by_state_id
            .get(id)
            .map(|idx| idx.clone())
            .and_then(move |idx| self.values.get_mut(idx))
            .and_then(|r| Some(&mut r.state))
    }
}
