use crate::indexing::ObjectSpecifier;
use crate::{pirate_defence, GameMode, GameState};
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::*;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(
    Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize, PartialEq, Eq,
)]
pub enum FriendOrFoe {
    Neutral,
    Friend,
    Foe,
}

#[derive(Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize)]
#[serde(tag = "tag")]
pub enum FofActor {
    Player { id: Uuid },
    Object { spec: ObjectSpecifier },
}

impl FofActor {
    pub fn get_object(self) -> ObjectSpecifier {
        match self {
            FofActor::Player { .. } => {
                panic!("FofActor::get_object on not an object actor")
            }
            FofActor::Object { spec } => spec,
        }
    }
}

pub fn friend_or_foe(state: &GameState, actor_a: FofActor, actor_b: FofActor) -> FriendOrFoe {
    match state.mode {
        GameMode::PirateDefence => pirate_defence::friend_or_foe(state, actor_a, actor_b),
        _ => FriendOrFoe::Neutral,
    }
}

pub fn resolve_player_id(actor: &FofActor, state: &GameState) -> Option<Uuid> {
    match actor {
        FofActor::Player { id } => Some(*id),
        FofActor::Object { spec } => match spec {
            ObjectSpecifier::Ship { id: ship_id } => state
                .players
                .iter()
                .find(|p| p.ship_id.map_or(false, |sid| sid == *ship_id))
                .map(|p| p.id),
            _ => None,
        },
    }
}
