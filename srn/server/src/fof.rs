use typescript_definitions::*;
use wasm_bindgen::prelude::wasm_bindgen;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;
use crate::{GameMode, GameState, pirate_defence};

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
pub enum FriendOrFoe {
    Unknown,
    Friend,
    Foe
}

pub fn friend_or_foe_p2p(state: &GameState, player_a: Uuid, player_b: Uuid) -> FriendOrFoe {
    match state.mode {
        GameMode::PirateDefence => pirate_defence::friend_or_foe_p2p(state, player_a, player_b),
        _ => FriendOrFoe::Unknown
    }
}
