use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::abilities::Ability;
use crate::indexing::{find_my_player_mut, find_my_ship_index, find_my_ship_mut, ObjectSpecifier};
use crate::vec2::Vec2f64;
use crate::world::{remove_object, GameState, LocalEffect, Location, Player, Ship};
use crate::{indexing, new_id, world};

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

#[derive(
    Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Copy, Default,
)]
pub struct Health {
    pub current: f64,
    pub max: f64,
}

impl Health {
    pub fn new(max: f64) -> Health {
        Health { current: max, max }
    }
}

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

    if shoot_ability.get_current_cooldown() > 0 {
        return false;
    }
    match target {
        ShootTarget::Unknown => {}
        ShootTarget::Ship { .. } => {}
        ShootTarget::Mineral { id } => {
            if let Some(min) = indexing::find_mineral(loc, id) {
                let min_pos = Vec2f64 { x: min.x, y: min.y };
                if !check_distance(ship, shoot_ability, min_pos) {
                    return false;
                }
            } else {
                return false;
            }
        }
        ShootTarget::Container { id } => {
            if let Some(cont) = indexing::find_container(loc, id) {
                if !check_distance(ship, shoot_ability, cont.position) {
                    return false;
                }
            } else {
                return false;
            }
        }
    };
    return true;
}

fn check_distance(ship: &Ship, shoot_ability: &Ability, min_pos: Vec2f64) -> bool {
    let ship_pos = Vec2f64 {
        x: ship.x,
        y: ship.y,
    };
    if min_pos.euclidean_distance(&ship_pos) > shoot_ability.get_distance() {
        return false;
    }
    return true;
}

pub const SHIP_SHOOT_STRENGTH: f64 = 20.0;

pub fn resolve_shoot(state: &mut GameState, player_id: Uuid, target: ShootTarget) {
    if let Some(ship_loc) = find_my_ship_index(state, player_id) {
        let loc = &state.locations[ship_loc.location_idx];
        let ship = &loc.ships[ship_loc.ship_idx];

        let shoot_ability = ship
            .abilities
            .iter()
            .find(|a| matches!(a, Ability::Shoot { .. }));
        if shoot_ability.is_none() {
            return;
        }
        let shoot_ability = shoot_ability.unwrap();

        match target {
            ShootTarget::Unknown => {}
            ShootTarget::Ship { id: ship_id } => {
                let dmg = SHIP_SHOOT_STRENGTH;
                let target_ship = state.locations[ship_loc.location_idx]
                    .ships
                    .iter_mut()
                    .find(|s| s.id == ship_id);
                let mut dmg_done = false;
                if let Some(target_ship) = target_ship {
                    target_ship.health.current -= dmg;
                    dmg_done = true;
                }
                if dmg_done {
                    let effect = LocalEffect::DmgDone {
                        id: new_id(),
                        hp: dmg as i32,
                        ship_id,
                        tick: state.ticks,
                    };

                    if let Some(target_player) = state
                        .players
                        .iter_mut()
                        .find(|p| p.ship_id.map_or(false, |s| s == ship_id))
                    {
                        target_player.local_effects.push(effect.clone())
                    }
                    if let Some(player) = find_my_player_mut(state, player_id) {
                        player.local_effects.push(effect.clone())
                    }
                }
            }
            ShootTarget::Mineral { id } => {
                if let Some(min) = indexing::find_mineral(loc, id) {
                    let min_pos = Vec2f64 { x: min.x, y: min.y };
                    if !check_distance(ship, shoot_ability, min_pos) {
                        return;
                    }
                    remove_object(
                        state,
                        ship_loc.location_idx,
                        ObjectSpecifier::Mineral { id },
                    )
                } else {
                    return;
                }
            }
            ShootTarget::Container { id } => {
                if let Some(cont) = indexing::find_container(loc, id) {
                    if !check_distance(ship, shoot_ability, cont.position) {
                        return;
                    }
                    remove_object(
                        state,
                        ship_loc.location_idx,
                        ObjectSpecifier::Container { id },
                    )
                } else {
                    return;
                }
            }
        }
    }
}
