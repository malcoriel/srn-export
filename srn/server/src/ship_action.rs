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
pub enum PlayerActionRust {
    Unknown,
    Move {
        update: ManualMoveUpdate,
    },
    Gas,
    StopGas,
    StopTurn,
    Reverse,
    TurnRight,
    TurnLeft,
    Dock,
    Navigate {
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
        player_id: Uuid,
    },
}

pub fn apply_player_action(
    player_action: PlayerActionRust,
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
        PlayerActionRust::Unknown => {
            warn!("Unknown ship action");
            None
        }
        PlayerActionRust::Move { .. } => {
            warn!("Move ship action is obsolete");
            Some(old_ship.clone())
        }
        PlayerActionRust::Dock => {
            warn!("Dock ship action is obsolete");
            Some(old_ship.clone())
        }
        PlayerActionRust::Navigate { target } => {
            let mut ship = old_ship.clone();
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };
            undock_ship_via_clone(state, &ship_idx, &mut ship, client, prng);
            ship.dock_target = None;
            ship.navigate_target = Some(target);
            ship.trajectory =
                trajectory::build_trajectory_to_point(ship_pos, &target, &ship.movement_definition);
            ship.movement_markers.gas = None;
            ship.movement_markers.turn = None;
            Some(ship)
        }
        PlayerActionRust::DockNavigate { target } => {
            let mut ship = old_ship.clone();
            if let Some(planet) = indexing::find_planet(state, &target) {
                if planet
                    .properties
                    .contains(&ObjectProperty::UnlandablePlanet)
                    && !ship.abilities.contains(&Ability::BlowUpOnLand)
                {
                    warn!(format!(
                        "Attempt to land on unlandable planet {} by ship {}, ignoring.",
                        planet.id, ship.id
                    ));
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
        PlayerActionRust::Tractor { target } => {
            let mut ship = old_ship.clone();
            tractoring::update_ship_tractor(
                target,
                &mut ship,
                &state.locations[ship_idx.location_idx].minerals,
                &state.locations[ship_idx.location_idx].containers,
            );
            Some(ship)
        }
        PlayerActionRust::Gas => {
            let mut ship = old_ship.clone();
            ship.movement_markers.gas = Some(MoveAxisParam {
                forward: true,
                last_tick: state.millis,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        PlayerActionRust::Reverse => {
            let mut ship = old_ship.clone();
            ship.movement_markers.gas = Some(MoveAxisParam {
                forward: false,
                last_tick: state.millis,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        PlayerActionRust::TurnRight => {
            let mut ship = old_ship.clone();
            ship.movement_markers.turn = Some(MoveAxisParam {
                forward: true,
                last_tick: state.millis,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        PlayerActionRust::TurnLeft => {
            let mut ship = old_ship.clone();
            ship.movement_markers.turn = Some(MoveAxisParam {
                forward: false,
                last_tick: state.millis,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        PlayerActionRust::StopGas => {
            let mut ship = old_ship.clone();
            ship.movement_markers.gas = None;
            Some(ship)
        }
        PlayerActionRust::StopTurn => {
            let mut ship = old_ship.clone();
            ship.movement_markers.turn = None;
            Some(ship)
        }
        PlayerActionRust::LongActionStart { .. } => {
            warn!("player action LongActionStart cannot be handled by apply_player_action");
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
