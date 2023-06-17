use crate::spatial_movement::Movement;
use crate::world::{GameState, Ship, ShipIdx};
use core::mem;
use serde_derive::{Deserialize, Serialize};
use serde_json::Value;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

pub const SHOOT_COOLDOWN_TICKS: i32 = 500 * 1000;
pub const SHOOT_ABILITY_DURATION: i32 = 25 * 1000;
pub const SHOOT_DEFAULT_DISTANCE: f64 = 50.0;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, PartialEq)]
#[serde(tag = "tag")]
pub enum Ability {
    Unknown,
    Shoot {
        cooldown_ticks_remaining: i32,
        turret_id: i32,
        cooldown_normalized: f64,
        cooldown_ticks_max: i32,
    },
    Launch {
        cooldown_ticks_remaining: i32,
        turret_id: i32,
        projectile_template_id: i32,
        cooldown_normalized: f64,
        cooldown_ticks_max: i32,
    },
    ShootAll,
    BlowUpOnLand,
    ToggleMovement {
        movements: Vec<Movement>,
        current_idx: usize,
    },
}

impl Ability {
    pub fn try_apply(&self, state: &mut GameState, ship_idx: ShipIdx, _params: Value) -> bool {
        let ship_mut = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
        return match self {
            Ability::ToggleMovement {
                movements,
                current_idx,
            } => {
                let new_index = (current_idx + 1) % movements.len();
                let new_movement = &movements[new_index];
                ship_mut.movement_definition = new_movement.clone();
                for ab in ship_mut.abilities.iter_mut() {
                    match ab {
                        Ability::ToggleMovement { current_idx, .. } => {
                            *current_idx = new_index;
                        }
                        _ => {}
                    }
                }
                true
            }
            _ => {
                warn!(format!("Cannot apply ability {self:?}"));
                false
            }
        };
    }

    pub fn set_max_cooldown(&mut self) {
        self.set_current_cooldown(self.get_cooldown_ticks());
    }

    pub fn get_cooldown_ticks(&self) -> i32 {
        match self {
            Ability::Unknown => 0,
            Ability::Shoot { .. } => SHOOT_COOLDOWN_TICKS,
            Ability::BlowUpOnLand => 0,
            Ability::ShootAll => 0,
            Ability::ToggleMovement { .. } => 0,
            Ability::Launch { .. } => SHOOT_COOLDOWN_TICKS,
        }
    }

    pub fn get_distance(&self) -> f64 {
        match self {
            Ability::Unknown => 0.0,
            Ability::Shoot { .. } => SHOOT_DEFAULT_DISTANCE,
            Ability::BlowUpOnLand => 0.0,
            Ability::ShootAll => 0.0,
            Ability::ToggleMovement { .. } => 0.0,
            Ability::Launch { .. } => SHOOT_DEFAULT_DISTANCE,
        }
    }

    pub fn get_current_cooldown(&self) -> i32 {
        return match self {
            Ability::Unknown => 0,
            Ability::Shoot {
                cooldown_ticks_remaining,
                ..
            } => *cooldown_ticks_remaining,
            Ability::BlowUpOnLand => 0,
            Ability::ShootAll => 0,
            Ability::ToggleMovement { .. } => 0,
            Ability::Launch {
                cooldown_ticks_remaining,
                ..
            } => *cooldown_ticks_remaining,
        };
    }

    pub fn set_current_cooldown(&mut self, val: i32) {
        match self {
            Ability::Unknown => {}
            Ability::Shoot {
                cooldown_ticks_remaining,
                ..
            } => {
                *cooldown_ticks_remaining = val;
            }
            Ability::BlowUpOnLand => {}
            Ability::ShootAll => {}
            Ability::ToggleMovement { .. } => {}
            Ability::Launch {
                cooldown_ticks_remaining,
                ..
            } => {
                *cooldown_ticks_remaining = val;
            }
        };
    }

    pub fn decrease_cooldown(&mut self, ticks_elapsed: i64) {
        return match self {
            Ability::Unknown => {}
            Ability::Shoot {
                cooldown_ticks_remaining,
                cooldown_normalized,
                cooldown_ticks_max,
                ..
            } => {
                *cooldown_ticks_remaining =
                    (*cooldown_ticks_remaining - ticks_elapsed as i32).max(0);
                *cooldown_normalized = (*cooldown_ticks_remaining as f64
                    / *cooldown_ticks_max as f64)
                    .max(0.0)
                    .min(1.0);
            }
            Ability::BlowUpOnLand => {}
            Ability::ShootAll => {}
            Ability::ToggleMovement { .. } => {}
            Ability::Launch {
                cooldown_ticks_remaining,
                cooldown_normalized,
                cooldown_ticks_max,
                ..
            } => {
                *cooldown_ticks_remaining =
                    (*cooldown_ticks_remaining - ticks_elapsed as i32).max(0);
                *cooldown_normalized = (*cooldown_ticks_remaining as f64
                    / *cooldown_ticks_max as f64)
                    .max(0.0)
                    .min(1.0);
            }
        };
    }
}

pub fn update_ships_ability_cooldowns(ships: &mut Vec<Ship>, ticks_passed: i64) {
    for ship in ships.iter_mut() {
        for ability in ship.abilities.iter_mut() {
            ability.decrease_cooldown(ticks_passed);
        }
    }
}

pub fn try_invoke(
    state: &mut GameState,
    ship_idx: ShipIdx,
    ability_idx: usize,
    ability_params: Value,
) -> bool {
    if state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx]
        .abilities
        .get(ability_idx)
        .is_none()
    {
        return false;
    }
    let ability_read = state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx].abilities
        [ability_idx]
        .clone();
    return ability_read.try_apply(state, ship_idx, ability_params);
}
