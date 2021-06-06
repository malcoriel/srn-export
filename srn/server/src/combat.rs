use crate::abilities::Ability;
use crate::vec2::Vec2f64;
use crate::world::{GameState, Location, Player, Ship};
use crate::{indexing, world};
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Copy)]
#[serde(tag = "tag")]
pub enum ShootTarget {
    Unknown,
    Ship { id: Uuid },
    Mineral { id: Uuid },
    Container { id: Uuid },
}

impl Default for ShootTarget {
    fn default() -> Self {
        ShootTarget::Unknown
    }
}

pub const SHOOT_DISTANCE: f64 = 50.0;
pub const SHOOT_COOLDOWN_MCS: i32 = 5 * 1000 * 1000;
pub const SHOOT_DURATION_TICKS: i32 = 5 * 1000 * 1000;

pub fn validate_shoot(
    target: ShootTarget,
    loc: &world::Location,
    _player: &Player,
    ship: &Ship,
) -> bool {
    let shoot_ability = ship
        .abilities
        .iter()
        .find(|a| matches!(a, Ability::Shoot { .. }));
    if shoot_ability.is_none() {
        return false;
    }
    let shoot_ability = shoot_ability.unwrap();
    log!(format!("cooldown rem {}", shoot_ability.cooldown()));

    if shoot_ability.cooldown() > 0 {
        return false;
    }
    match target {
        ShootTarget::Unknown => {}
        ShootTarget::Ship { .. } => {}
        ShootTarget::Mineral { id } => {
            if let Some(min) = indexing::find_mineral(loc, id) {
                let min_pos = Vec2f64 { x: min.x, y: min.y };
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                if min_pos.euclidean_distance(&ship_pos) > SHOOT_DISTANCE {
                    return false;
                }
            } else {
                return false;
            }
        }
        ShootTarget::Container { .. } => {}
    };
    return true;
}
