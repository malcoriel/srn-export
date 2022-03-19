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
        target: Uuid,
    },
    Tractor {
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
    client: bool,
    prng: &mut SmallRng,
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
        Action::DockNavigate { target } => {
            let mut ship = old_ship.clone();
            if let Some(planet) = indexing::find_planet(state, &target) {
                if planet
                    .properties
                    .contains(&ObjectProperty::UnlandablePlanet)
                    && !ship.abilities.contains(&Ability::BlowUpOnLand)
                {
                    // technically some logic bug signifier, but it also conflicts with one of the test hacks
                    // in 'can start long action TransSystemJump' test
                    // warn!(format!(
                    //     "Attempt to land on unlandable planet {} by ship {}, ignoring.",
                    //     planet.id, ship.id
                    // ));
                    None
                } else {
                    let ship_pos = Vec2f64 {
                        x: ship.x,
                        y: ship.y,
                    };
                    let planet_pos = Vec2f64 {
                        x: planet.x,
                        y: planet.y,
                    };
                    undock_ship_via_clone(state, &ship_idx, &mut ship, client, prng);
                    ship.navigate_target = None;
                    ship.dock_target = None;
                    ship.dock_target = Some(target);
                    ship.trajectory = trajectory::build_trajectory_to_point(
                        ship_pos,
                        &planet_pos,
                        &ship.movement_definition,
                    );
                    ship.movement_markers.gas = None;
                    ship.movement_markers.turn = None;
                    Some(ship)
                }
            } else {
                None
            }
        }
        Action::Tractor { target } => {
            let mut ship = old_ship.clone();
            tractoring::update_ship_tractor(
                target,
                &mut ship,
                &state.locations[ship_idx.location_idx].minerals,
                &state.locations[ship_idx.location_idx].containers,
            );
            Some(ship)
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

fn undock_ship_via_clone(
    state: &GameState,
    ship_idx: &ShipIdx,
    mut ship: &mut Ship,
    client: bool,
    prng: &mut SmallRng,
) {
    let mut state_mut_clone = state.clone();
    undock_ship(
        &mut state_mut_clone,
        ship_idx.clone(),
        client,
        find_player_idx_by_ship_id(state, ship.id),
        prng,
    );
    let mut mutated_ship =
        state_mut_clone.locations[ship_idx.location_idx].ships[ship_idx.ship_idx].clone();
    mem::swap(&mut mutated_ship, &mut ship);
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
