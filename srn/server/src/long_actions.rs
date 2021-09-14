use core::mem;

use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::abilities::Ability;
use crate::combat::ShootTarget;
use crate::indexing::{
    find_my_player, find_my_player_mut, find_my_ship_index, find_my_ship_mut,
    find_player_by_ship_id,
};
use crate::planet_movement::IBody;
use crate::vec2::Vec2f64;
use crate::world::{spawn_ship, GameState, PLAYER_RESPAWN_TIME_MC};
use crate::{combat, indexing, locations, new_id, world};
use rand::prelude::SmallRng;
use rand::Rng;
use std::f64::consts::PI;

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone, Copy)]
#[serde(tag = "tag")]
pub enum LongActionStart {
    Unknown,
    TransSystemJump { to: Uuid },
    Respawn,
    Shoot { target: ShootTarget },
    Dock { to_planet: Uuid },
    Undock { from_planet: Uuid },
}

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongActionPlayer {
    Unknown {
        id: Uuid,
    },
    Respawn {
        id: Uuid,
        micro_left: i32,
        percentage: u32,
    },
}

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongAction {
    Unknown {
        id: Uuid,
    },
    TransSystemJump {
        id: Uuid,
        to: Uuid,
        micro_left: i32,
        percentage: u32,
    },
    Shoot {
        id: Uuid,
        target: ShootTarget,
        micro_left: i32,
        percentage: u32,
    },
    Dock {
        id: Uuid,
        to_planet: Uuid,
        start_pos: Vec2f64,
        micro_left: i32,
        percentage: u32,
    },
    Undock {
        id: Uuid,
        from_planet: Uuid,
        start_pos: Vec2f64,
        end_pos: Vec2f64,
        micro_left: i32,
        percentage: u32,
    },
}

pub fn erase_details(la: LongAction) -> LongAction {
    return match la {
        LongAction::Unknown { .. } => LongAction::Unknown {
            id: Default::default(),
        },
        LongAction::TransSystemJump { .. } => LongAction::TransSystemJump {
            id: Default::default(),
            to: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Shoot { .. } => LongAction::Shoot {
            id: Default::default(),
            target: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Dock { .. } => LongAction::Dock {
            id: Default::default(),
            to_planet: Default::default(),
            start_pos: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Undock { .. } => LongAction::Undock {
            id: Default::default(),
            from_planet: Default::default(),
            start_pos: Default::default(),
            end_pos: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
    };
}

// This will compare the type only, all details like id are ignored for the sake of equality
pub fn cancel_all_long_actions_of_type(la: &mut Vec<LongAction>, template: LongAction) {
    // rust does not understand usage in matches! macro
    let _t = erase_details(template);
    let mut new_la = la
        .clone()
        .into_iter()
        .filter_map(|a| {
            return if matches!(erase_details(a.clone()), _t) {
                None
            } else {
                Some(a)
            };
        })
        .collect();
    mem::swap(la, &mut new_la);
}

pub fn try_start_long_action(
    state: &mut GameState,
    player_id: Uuid,
    action: LongActionStart,
    prng: &mut SmallRng,
) -> bool {
    match action {
        LongActionStart::Unknown => {
            return false;
        }
        LongActionStart::TransSystemJump { to } => {
            if !locations::can_be_moved_player(state, player_id, to) {
                return false;
            }
            let ship = find_my_ship_mut(state, player_id);
            if ship.is_none() {
                return false;
            }
            let ship = ship.unwrap();
            ship.long_actions.push(LongAction::TransSystemJump {
                id: new_id(),
                to,
                micro_left: TRANS_SYSTEM_JUMP_TIME,
                percentage: 0,
            });
            revalidate(&mut ship.long_actions);
        }
        LongActionStart::Respawn => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_some() {
                return false;
            }
            let player = find_my_player_mut(state, player_id);
            if player.is_none() {
                return false;
            }
            let player = player.unwrap();
            player.long_actions.push(LongActionPlayer::Respawn {
                id: new_id(),
                micro_left: PLAYER_RESPAWN_TIME_MC,
                percentage: 0,
            });
            revalidate_player(&mut player.long_actions);
        }
        LongActionStart::Shoot { target } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            if !combat::validate_shoot(
                target.clone(),
                &state.locations[ship_idx.location_idx],
                &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx],
            ) {
                return false;
            }

            let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
            ship.long_actions.push(LongAction::Shoot {
                id: new_id(),
                target,
                micro_left: Ability::Shoot {
                    cooldown_ticks_remaining: 0,
                }
                .get_cooldown(),
                percentage: 0,
            });
            revalidate(&mut ship.long_actions);
            for ability in ship.abilities.iter_mut() {
                match ability {
                    Ability::Unknown => {}
                    Ability::Shoot { .. } => {
                        ability.set_max_cooldown();
                    }
                }
            }
        }
        LongActionStart::Dock { to_planet, .. } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            let ship = &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
            let planet = &state.locations[ship_idx.location_idx]
                .planets
                .iter()
                .find(|p| p.id == to_planet);
            if planet.is_none() {
                return false;
            }
            let planet = planet.unwrap();
            // currently, docking can only be initiated in the planet radius
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };
            let planet_pos = Vec2f64 {
                x: planet.x,
                y: planet.y,
            };
            if planet_pos.euclidean_distance(&ship_pos)
                > (planet.radius * SHIP_DOCKING_RADIUS_COEFF).max(MIN_SHIP_DOCKING_RADIUS)
            {
                return false;
            }
            let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
            let act = LongAction::Dock {
                id: new_id(),
                to_planet,
                start_pos: ship_pos,
                micro_left: SHIP_DOCK_TIME_TICKS,
                percentage: 0,
            };
            ship.long_actions.push(act);
            ship.trajectory = vec![];
            ship.dock_target = None;
            ship.navigate_target = None;
        }
        LongActionStart::Undock { from_planet } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            let planet = &state.locations[ship_idx.location_idx]
                .planets
                .iter()
                .find(|p| p.id == from_planet);
            if planet.is_none() {
                return false;
            }
            let planet = planet.unwrap();
            let random_angle = prng.gen_range(0.0, PI * 2.0);
            let dist = (planet.radius * 1.2).max(MIN_SHIP_DOCKING_RADIUS);
            let planet_pos = Vec2f64 {
                x: planet.x,
                y: planet.y,
            };
            let vec = Vec2f64 { x: 1.0, y: 0.0 }
                .rotate(random_angle)
                .scalar_mul(dist)
                .add(&planet_pos);
            let act = LongAction::Undock {
                id: new_id(),
                from_planet,
                start_pos: planet_pos,
                end_pos: Vec2f64 { x: vec.x, y: vec.y },
                micro_left: SHIP_DOCK_TIME_TICKS,
                percentage: 0,
            };
            let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
            ship.long_actions.push(act);
        }
    }
    return true;
}

fn revalidate(long_actions: &mut Vec<LongAction>) {
    let mut has_jump = false;
    let mut has_dock = false;
    let mut has_undock = false;
    let mut has_shoot = false;
    let mut new_actions = long_actions
        .clone()
        .into_iter()
        .filter_map(|a| match a {
            LongAction::Unknown { .. } => Some(a),
            LongAction::TransSystemJump { .. } => {
                if has_jump {
                    return None;
                }
                has_jump = true;
                Some(a)
            }
            LongAction::Shoot { .. } => {
                if has_shoot {
                    return None;
                }
                has_shoot = true;
                Some(a)
            }
            LongAction::Dock { .. } => {
                if has_dock || has_undock {
                    return None;
                }
                has_dock = true;
                Some(a)
            }
            LongAction::Undock { .. } => {
                if has_dock || has_undock {
                    return None;
                }
                has_undock = true;
                Some(a)
            }
        })
        .collect();
    mem::swap(long_actions, &mut new_actions);
}

fn revalidate_player(long_actions: &mut Vec<LongActionPlayer>) {
    let mut has_respawn = false;
    let mut new_actions = long_actions
        .clone()
        .into_iter()
        .filter_map(|a| match a {
            LongActionPlayer::Unknown { .. } => Some(a),
            LongActionPlayer::Respawn { .. } => {
                if has_respawn {
                    return None;
                }
                has_respawn = true;
                Some(a)
            }
        })
        .collect();
    mem::swap(long_actions, &mut new_actions);
}

const TRANS_SYSTEM_JUMP_TIME: i32 = 5 * 1000 * 1000;
const SHIP_DOCK_TIME_TICKS: i32 = 1 * 1000 * 1000;
const SHIP_UNDOCK_TIME_TICKS: i32 = 1 * 1000 * 1000;
pub const SHIP_DOCKING_RADIUS_COEFF: f64 = 2.0;
pub const MIN_SHIP_DOCKING_RADIUS: f64 = 5.0;

pub fn finish_long_act(state: &mut GameState, player_id: Uuid, act: LongAction, client: bool) {
    match act {
        LongAction::Unknown { .. } => {
            // nothing to do
        }
        LongAction::TransSystemJump { to, .. } => {
            if !client {
                locations::try_move_player_ship(state, player_id, to);
            }
        }
        LongAction::Shoot { target, .. } => {
            if !client {
                combat::resolve_shoot(state, player_id, target);
            }
        }
        LongAction::Dock { to_planet, .. } => {
            let player = indexing::find_my_player(state, player_id);
            let planet = indexing::find_planet(state, &to_planet).map(|p| p.clone());
            let ship = indexing::find_my_ship_mut(state, player_id);
            if let (Some(ship), player, Some(planet)) = (ship, player, planet) {
                let body = Box::new(planet) as Box<dyn IBody>;
                world::dock_ship(ship, player, &body);
            }
        }
        LongAction::Undock { .. } => {
            let ship = indexing::find_my_ship_index(state, player_id);
            if let Some(ship) = ship {
                let ship_id = ship.id;
                world::undock_ship(state, ship, client, find_player_by_ship_id(state, ship_id));
            }
        }
    }
}

pub fn finish_long_act_player(
    state: &mut GameState,
    player_id: Uuid,
    act: LongActionPlayer,
    client: bool,
) {
    match act {
        LongActionPlayer::Unknown { .. } => {
            // nothing to do
        }
        LongActionPlayer::Respawn { .. } => {
            if !client {
                spawn_ship(state, Some(player_id), None, false);
            }
        }
    }
}

// (update_action, keep_ticking)
pub fn tick_long_act(act: LongAction, micro_passed: i64) -> (LongAction, bool) {
    return match act {
        LongAction::Unknown { id } => (LongAction::Unknown { id }, false),
        LongAction::TransSystemJump {
            to, id, micro_left, ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::TransSystemJump {
                    id,
                    to,
                    micro_left: left,
                    percentage: calc_percentage(left, TRANS_SYSTEM_JUMP_TIME),
                },
                left > 0,
            )
        }
        LongAction::Shoot {
            micro_left,
            id,
            target,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Shoot {
                    id,
                    micro_left: left,
                    target,
                    percentage: calc_percentage(
                        left,
                        Ability::Shoot {
                            cooldown_ticks_remaining: 0,
                        }
                        .get_duration(),
                    ),
                },
                left > 0,
            )
        }
        LongAction::Dock {
            micro_left,
            id,
            to_planet,
            start_pos,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Dock {
                    id,
                    micro_left: left,
                    to_planet,
                    start_pos,
                    percentage: calc_percentage(left, SHIP_DOCK_TIME_TICKS),
                },
                left > 0,
            )
        }
        LongAction::Undock {
            micro_left,
            id,
            from_planet,
            start_pos,
            end_pos,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Undock {
                    id,
                    micro_left: left,
                    from_planet,
                    start_pos,
                    end_pos,
                    percentage: calc_percentage(left, SHIP_UNDOCK_TIME_TICKS),
                },
                left > 0,
            )
        }
    };
}

// (update_action, keep_ticking)
pub fn tick_long_act_player(act: LongActionPlayer, micro_passed: i64) -> (LongActionPlayer, bool) {
    return match act {
        LongActionPlayer::Unknown { id } => (LongActionPlayer::Unknown { id }, false),
        LongActionPlayer::Respawn { micro_left, id, .. } => {
            let left = micro_left - micro_passed as i32;
            (
                LongActionPlayer::Respawn {
                    id,
                    micro_left: left,
                    percentage: calc_percentage(left, PLAYER_RESPAWN_TIME_MC),
                },
                left > 0,
            )
        }
    };
}

fn calc_percentage(left: i32, max: i32) -> u32 {
    (((max as f32 - left as f32) / max as f32).max(0.0) * 100.0) as u32
}
