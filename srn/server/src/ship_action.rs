use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::abilities::Ability;
use crate::combat::ShootTarget;
use crate::indexing::{find_my_ship_index, find_player_by_ship_id, find_player_idx_by_ship_id};
use crate::long_actions::LongActionStart;
use crate::planet_movement::IBody;
use crate::vec2::Vec2f64;
use crate::world::{
    dock_ship, undock_ship, GameState, ManualMoveUpdate, ObjectProperty, Ship, ShipIdx,
};
use crate::world_events::GameEvent;
use crate::{combat, fire_event, indexing, tractoring, trajectory, world};
use core::mem;
use rand::prelude::SmallRng;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum Action {
    Unknown,
    Move {
        update: ManualMoveUpdate,
    },
    Gas {
        ship_id: Uuid,
    },
    StopGas {
        ship_id: Uuid,
    },
    StopTurn {
        ship_id: Uuid,
    },
    Reverse {
        ship_id: Uuid,
    },
    TurnRight {
        ship_id: Uuid,
    },
    TurnLeft {
        ship_id: Uuid,
    },
    Dock,
    Navigate {
        ship_id: Uuid,
        target: Vec2f64,
    },
    DockNavigate {
        ship_id: Uuid,
        target: Uuid,
    },
    Tractor {
        ship_id: Uuid,
        target: Uuid,
    },
    LongActionStart {
        long_action_start: LongActionStart,
        player_id: Option<Uuid>,
        ship_id: Uuid,
    },
}

pub fn apply_player_action(
    player_action: Action,
    state: &GameState,
    ship_idx: Option<ShipIdx>,
    _client: bool,
    _prng: &mut SmallRng,
) -> Option<Ship> {
    if ship_idx.is_none() {
        warn!("No ship");
        return None;
    }
    let ship_idx = ship_idx.unwrap();
    let old_ship = &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

    match player_action {
        Action::Unknown => {
            warn!("Unknown ship action");
            None
        }
        Action::Move { .. } => {
            warn!("Move ship action is obsolete");
            Some(old_ship.clone())
        }
        Action::Dock => {
            warn!("Dock ship action is obsolete");
            Some(old_ship.clone())
        }
        Action::Navigate { .. } => {
            warn!("player action Navigate must be handled through world player actions");
            None
        }
        Action::DockNavigate { .. } => {
            warn!("player action DockNavigate must be handled through world player actions");
            None
        }
        Action::Tractor { .. } => {
            warn!("player action Tractor must be handled through world player actions");
            None
        }
        Action::Gas { .. } => {
            warn!("player action Gas must be handled through world player actions");
            None
        }
        Action::Reverse { .. } => {
            warn!("player action Reverse must be handled through world player actions");
            None
        }
        Action::TurnRight { .. } => {
            warn!("player action TurnRight must be handled through world player actions");
            None
        }
        Action::TurnLeft { .. } => {
            warn!("player action TurnLeft must be handled through world player actions");
            None
        }
        Action::StopGas { .. } => {
            warn!("player action StopGas must be handled through world player actions");
            None
        }
        Action::StopTurn { .. } => {
            warn!("player action StopTurn must be handled through world player actions");
            None
        }
        Action::LongActionStart { .. } => {
            warn!("player action LongActionStart must be handled through world player actions");
            None
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct MoveAxisParam {
    pub forward: bool,
    pub last_tick: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ShipMovementMarkers {
    pub gas: Option<MoveAxisParam>,
    pub turn: Option<MoveAxisParam>,
}

impl ShipMovementMarkers {
    pub fn new() -> Self {
        Self {
            gas: None,
            turn: None,
        }
    }
}

impl Default for ShipMovementMarkers {
    fn default() -> Self {
        ShipMovementMarkers::new()
    }
}
