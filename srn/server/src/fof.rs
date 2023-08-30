use crate::indexing::{find_owning_player, ObjectIndexSpecifier, ObjectSpecifier};
use crate::world::Location;
use crate::{pirate_defence, GameMode, GameState};
use serde_derive::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use std::collections::{HashMap, HashSet};
use typescript_definitions::*;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(
    Debug, Clone, TypescriptDefinition, TypeScriptify, Serialize, Deserialize, PartialEq, Eq, Copy,
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
    from: FofActor,
    to: FofActor,
    loc_idx: usize,
) -> FriendOrFoe {
    if let Some(over) = try_fof_override(state, &from, &to, loc_idx) {
        return over;
    }
    match state.mode {
        GameMode::PirateDefence => pirate_defence::friend_or_foe(state, from, to, loc_idx),
        _ => fof_default(state, &from, &to, loc_idx),
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

pub fn fof_default(
    state: &GameState,
    from: &FofActor,
    to: &FofActor,
    loc_idx: usize,
) -> FriendOrFoe {
    if let Some(value) = try_fof_override(state, from, to, loc_idx) {
        return value;
    }
    return FriendOrFoe::Neutral;
}

fn try_fof_override(
    state: &GameState,
    from: &FofActor,
    to: &FofActor,
    loc_idx: usize,
) -> Option<FriendOrFoe> {
    let overrides = find_fof_overrides(state, &from, loc_idx);
    if let Some(overrides) = overrides {
        let key = FofObjectClass::from_actor(to);
        if let Some(val) = overrides.obj_class.get(&key) {
            return Some(val.clone());
        }
    }
    None
}

fn find_fof_overrides<'a, 'b>(
    state: &'a GameState,
    from: &'b FofActor,
    loc_idx: usize,
) -> Option<&'a FofOverrides> {
    match from {
        FofActor::Player { .. } => None,
        FofActor::ObjectIdx { spec } => match spec {
            ObjectIndexSpecifier::Ship { idx } => {
                state.locations[loc_idx].ships[*idx].fof_overrides.as_ref()
            }
            _ => None,
        },
    }
}

pub fn resolve_player_id(actor: &FofActor, state: &GameState, loc_idx: usize) -> Option<Uuid> {
    match actor {
        FofActor::Player { id } => Some(*id),
        FofActor::ObjectIdx { spec } => find_owning_player(state, loc_idx, spec),
    }
}

#[derive(
    Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, PartialEq, Eq, Hash,
)]
pub enum FofObjectClass {
    Unknown,
    Asteroids,
}

impl FofObjectClass {
    pub fn from_actor(actor: &FofActor) -> FofObjectClass {
        match actor {
            FofActor::Player { .. } => FofObjectClass::Unknown,
            FofActor::ObjectIdx { spec } => match spec {
                ObjectIndexSpecifier::Asteroid { .. } => FofObjectClass::Asteroids,
                _ => FofObjectClass::Unknown,
            },
        }
    }
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct FofOverrides {
    pub obj_class: HashMap<FofObjectClass, FriendOrFoe>,
}
