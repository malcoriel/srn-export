use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::combat::ShootTarget;
use crate::vec2::Vec2f64;
use crate::world::{GameEvent, GameState, ManualMoveUpdate, Ship};
use crate::{combat, fire_event, indexing, tractoring, world};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum ShipActionRust {
    Unknown,
    Move { update: ManualMoveUpdate },
    Gas,
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
            // let mut ship = old_ship.clone();
            // ship.x = update.position.x;
            // ship.y = update.position.y;
            // ship.rotation = update.rotation;
            // ship.navigate_target = None;
            // ship.dock_target = None;
            // ship.trajectory = vec![];
            Some(old_ship.clone())
        }
        ShipActionRust::Dock => {
            let mut ship = old_ship.clone();
            ship.navigate_target = None;
            ship.dock_target = None;
            if ship.docked_at.is_some() {
                let planet_id = ship.docked_at.unwrap();
                let planet = indexing::find_planet(state, &planet_id).unwrap().clone();
                let player = indexing::find_my_player(state, player_id).unwrap().clone();
                ship.docked_at = None;
                fire_event(GameEvent::ShipUndocked {
                    ship: ship.clone(),
                    planet,
                    player,
                });
            } else {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                for planet in state.locations[ship_idx.location_idx].planets.iter() {
                    let pos = Vec2f64 {
                        x: planet.x,
                        y: planet.y,
                    };
                    if pos.euclidean_distance(&ship_pos) < planet.radius {
                        ship.docked_at = Some(planet.id);
                        ship.x = planet.x;
                        ship.y = planet.y;
                        ship.navigate_target = None;
                        ship.dock_target = None;
                        ship.trajectory = vec![];
                        let player = indexing::find_my_player(state, player_id).unwrap().clone();

                        fire_event(GameEvent::ShipDocked {
                            ship: ship.clone(),
                            player,
                            planet: planet.clone(),
                        });
                        break;
                    }
                }
            }
            Some(ship)
        }
        ShipActionRust::Navigate { target } => {
            let mut ship = old_ship.clone();
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };

            ship.navigate_target = None;
            ship.dock_target = None;
            ship.docked_at = None;
            ship.navigate_target = Some(target);
            ship.trajectory = world::build_trajectory_to_point(ship_pos, &target);
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
                ship.docked_at = None;
                ship.dock_target = Some(target);
                ship.trajectory = world::build_trajectory_to_point(ship_pos, &planet_pos);
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
            Some(ship)
        }
        ShipActionRust::Reverse => {
            let mut ship = old_ship.clone();
            ship.movement.gas = Some(MoveAxisParam {
                forward: false,
                last_tick: state.ticks,
            });
            Some(ship)
        }
        ShipActionRust::TurnRight => {
            let mut ship = old_ship.clone();
            ship.movement.turn = Some(MoveAxisParam {
                forward: true,
                last_tick: state.ticks,
            });
            Some(ship)
        }
        ShipActionRust::TurnLeft => {
            let mut ship = old_ship.clone();
            ship.movement.turn = Some(MoveAxisParam {
                forward: false,
                last_tick: state.ticks,
            });
            Some(ship)
        }
    }
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
