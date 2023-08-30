use crate::indexing::{find_owning_player, ObjectIndexSpecifier, ObjectSpecifier};
use crate::world::Location;
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
    ObjectIdx { spec: ObjectIndexSpecifier },
}

pub fn friend_or_foe(
    state: &GameState,
    actor_a: FofActor,
    actor_b: FofActor,
    loc_idx: usize,
) -> FriendOrFoe {
    match state.mode {
        GameMode::PirateDefence => pirate_defence::friend_or_foe(state, actor_a, actor_b, loc_idx),
        _ => fof_default(state, actor_a, actor_b),
    }
}

pub fn friend_or_foe_idx(
    state: &GameState,
    actor_a: FofActor,
    actor_b: &ObjectIndexSpecifier,
    loc_idx: usize,
) -> FriendOrFoe {
    return friend_or_foe(
        state,
        actor_a,
        FofActor::ObjectIdx {
            spec: actor_b.clone(),
        },
        loc_idx,
    );
}

pub fn fof_default(p0: &GameState, p1: FofActor, p2: FofActor) -> FriendOrFoe {
    return FriendOrFoe::Neutral;
}

pub fn resolve_player_id(actor: &FofActor, state: &GameState, loc_idx: usize) -> Option<Uuid> {
    match actor {
        FofActor::Player { id } => Some(*id),
        FofActor::ObjectIdx { spec } => find_owning_player(state, loc_idx, spec),
    }
}
