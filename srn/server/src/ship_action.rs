use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::combat::ShootTarget;
use crate::indexing::find_my_ship_index;
use crate::planet_movement::IBody;
use crate::vec2::Vec2f64;
use crate::world::{dock_ship, undock_ship, GameEvent, GameState, ManualMoveUpdate, Ship};
use crate::{combat, fire_event, indexing, tractoring, world};
use core::mem;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum ShipActionRust {
    Unknown,
    Move { update: ManualMoveUpdate },
    Gas,
    StopGas,
    StopTurn,
    Reverse,
    TurnRight,
    TurnLeft,
    Dock,
    Navigate { target: Vec2f64 },
    DockNavigate { target: Uuid },
    Tractor { target: Uuid },
}

pub fn apply_ship_action(
    ship_action: ShipActionRust,
    state: &GameState,
    player_id: Uuid,
    client: bool,
) -> Option<Ship> {
    let ship_idx = indexing::find_my_ship_index(state, player_id);
    if ship_idx.is_none() {
        warn!("No ship");
        return None;
    }
    let ship_idx = ship_idx.unwrap();
    let old_ship = &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

    match ship_action {
        ShipActionRust::Unknown => {
            warn!("Unknown ship action");
            None
        }
        ShipActionRust::Move { .. } => {
            warn!("Move ship action is obsolete");
            Some(old_ship.clone())
        }
        ShipActionRust::Dock => {
            warn!("Dock ship action is obsolete");
            Some(old_ship.clone())
        }
        ShipActionRust::Navigate { target } => {
            let mut ship = old_ship.clone();
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };
            ship.navigate_target = None;
            ship.dock_target = None;
            undock_ship_via_clone(state, player_id, &mut ship, client);
            ship.navigate_target = Some(target);
            ship.trajectory = world::build_trajectory_to_point(ship_pos, &target);
            ship.movement.gas = None;
            ship.movement.turn = None;
            Some(ship)
        }
        ShipActionRust::DockNavigate { target } => {
            let mut ship = old_ship.clone();
            if let Some(planet) = indexing::find_planet(state, &target) {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let planet_pos = Vec2f64 {
                    x: planet.x,
                    y: planet.y,
                };
                ship.navigate_target = None;
                ship.dock_target = None;
                undock_ship_via_clone(state, player_id, &mut ship, client);
                ship.dock_target = Some(target);
                ship.trajectory = world::build_trajectory_to_point(ship_pos, &planet_pos);
                ship.movement.gas = None;
                ship.movement.turn = None;
                Some(ship)
            } else {
                None
            }
        }
        ShipActionRust::Tractor { target } => {
            let mut ship = old_ship.clone();
            tractoring::update_ship_tractor(
                target,
                &mut ship,
                &state.locations[ship_idx.location_idx].minerals,
                &state.locations[ship_idx.location_idx].containers,
            );
            Some(ship)
        }
        ShipActionRust::Gas => {
            let mut ship = old_ship.clone();
            ship.movement.gas = Some(MoveAxisParam {
                forward: true,
                last_tick: state.ticks,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        ShipActionRust::Reverse => {
            let mut ship = old_ship.clone();
            ship.movement.gas = Some(MoveAxisParam {
                forward: false,
                last_tick: state.ticks,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        ShipActionRust::TurnRight => {
            let mut ship = old_ship.clone();
            ship.movement.turn = Some(MoveAxisParam {
                forward: true,
                last_tick: state.ticks,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        ShipActionRust::TurnLeft => {
            let mut ship = old_ship.clone();
            ship.movement.turn = Some(MoveAxisParam {
                forward: false,
                last_tick: state.ticks,
            });
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        ShipActionRust::StopGas => {
            let mut ship = old_ship.clone();
            ship.movement.gas = None;
            Some(ship)
        }
        ShipActionRust::StopTurn => {
            let mut ship = old_ship.clone();
            ship.movement.turn = None;
            Some(ship)
        }
    }
}

fn undock_ship_via_clone(state: &GameState, player_id: Uuid, mut ship: &mut Ship, client: bool) {
    let mut state_mut_clone = state.clone();
    let ship_idx = find_my_ship_index(&state_mut_clone, player_id).unwrap();
    undock_ship(&mut state_mut_clone, ship_idx.clone(), player_id, client);
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
pub struct ShipMovement {
    pub gas: Option<MoveAxisParam>,
    pub turn: Option<MoveAxisParam>,
}

impl ShipMovement {
    pub fn new() -> Self {
        Self {
            gas: None,
            turn: None,
        }
    }
}

impl Default for ShipMovement {
    fn default() -> Self {
        ShipMovement::new()
    }
}
