use crate::world::Ship;
use core::mem;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Copy)]
#[serde(tag = "tag")]
pub enum Ability {
    Unknown,
    Shoot { cooldown_ticks_remaining: i32 },
}

impl Ability {
    pub fn get_duration(&self) -> i32 {
        match self {
            Ability::Unknown => 0,
            Ability::Shoot { .. } => 100 * 1000,
        }
    }

    pub fn set_max_cooldown(&mut self) {
        self.set_current_cooldown(self.get_cooldown());
    }

    pub fn get_cooldown(&self) -> i32 {
        match self {
            Ability::Unknown => 0,
            Ability::Shoot { .. } => 200 * 1000,
        }
    }

    pub fn get_distance(&self) -> f64 {
        match self {
            Ability::Unknown => 0.0,
            Ability::Shoot { .. } => 50.0,
        }
    }

    pub fn get_current_cooldown(&self) -> i32 {
        return match self {
            Ability::Unknown => 0,
            Ability::Shoot {
                cooldown_ticks_remaining,
            } => *cooldown_ticks_remaining,
        };
    }

    pub fn set_current_cooldown(&mut self, val: i32) {
        match self {
            Ability::Unknown => {}
            Ability::Shoot {
                cooldown_ticks_remaining,
            } => mem::swap(cooldown_ticks_remaining, &mut val.clone()),
        };
    }

    pub fn decrease_cooldown(&mut self, ticks_elapsed: i64) {
        return match self {
            Ability::Unknown => {}
            Ability::Shoot {
                cooldown_ticks_remaining,
            } => {
                let mut new_val = (*cooldown_ticks_remaining - ticks_elapsed as i32).max(0);
                mem::swap(cooldown_ticks_remaining, &mut new_val);
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
