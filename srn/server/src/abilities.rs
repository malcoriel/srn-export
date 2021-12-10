use crate::world::Ship;
use core::mem;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

pub const SHOOT_COOLDOWN_TICKS: i32 = 200 * 1000;
pub const SHOOT_ABILITY_DURATION: i32 = 100 * 1000;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Copy, PartialEq)]
#[serde(tag = "tag")]
pub enum Ability {
    Unknown,
    Shoot { cooldown_ticks_remaining: i32, turret_id: Uuid, cooldown_normalized: f64, cooldown_ticks_max: i32 },
    ShootAll,
    BlowUpOnLand,
}

impl Ability {
    pub fn set_max_cooldown(&mut self) {
        self.set_current_cooldown(self.get_cooldown_ticks());
    }

    pub fn get_cooldown_ticks(&self) -> i32 {
        match self {
            Ability::Unknown => 0,
            Ability::Shoot { .. } => SHOOT_COOLDOWN_TICKS,
            Ability::BlowUpOnLand => 0,
            Ability::ShootAll => 0
        }
    }

    pub fn get_distance(&self) -> f64 {
        match self {
            Ability::Unknown => 0.0,
            Ability::Shoot { .. } => 50.0,
            Ability::BlowUpOnLand => 0.0,
            Ability::ShootAll => 0.0
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
            Ability::ShootAll => 0
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
                *cooldown_normalized = (*cooldown_ticks_remaining as f64 / *cooldown_ticks_max as f64).max(0.0).min(1.0);
            }
            Ability::BlowUpOnLand => {}
            Ability::ShootAll => {}
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
