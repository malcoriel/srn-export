use crate::abilities::Ability;
use crate::combat::{ShootTarget, SHOOT_COOLDOWN_MCS};
use crate::world::{
    find_my_player, find_my_player_mut, find_my_ship_index, spawn_ship, GameState,
    PLAYER_RESPAWN_TIME_MC,
};
use crate::{combat, locations, new_id};
use core::mem;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone, Copy)]
#[serde(tag = "tag")]
pub enum LongActionStart {
    Unknown,
    TransSystemJump { to: Uuid },
    Respawn,
    Shoot { target: ShootTarget },
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
    Respawn {
        id: Uuid,
        micro_left: i32,
        percentage: u32,
    },
    Shoot {
        id: Uuid,
        target: ShootTarget,
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
        LongAction::Respawn { .. } => LongAction::Respawn {
            id: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Shoot { .. } => LongAction::Shoot {
            id: Default::default(),
            target: Default::default(),
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
) -> bool {
    match action {
        LongActionStart::Unknown => {
            return false;
        }
        LongActionStart::TransSystemJump { to } => {
            if !locations::can_be_moved_player(state, player_id, to) {
                return false;
            }
            let player = find_my_player_mut(state, player_id);
            if player.is_none() {
                return false;
            }
            let player = player.unwrap();
            player.long_actions.push(start_long_act(action));
            revalidate(&mut player.long_actions);
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
            player.long_actions.push(start_long_act(action));
            revalidate(&mut player.long_actions);
        }
        LongActionStart::Shoot { target } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            let player = find_my_player(state, player_id);
            if player.is_none() {
                return false;
            }
            let player = player.unwrap();
            if !combat::validate_shoot(
                target.clone(),
                &state.locations[ship_idx.location_idx],
                &player,
                &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx],
            ) {
                return false;
            }

            let player = find_my_player_mut(state, player_id).unwrap();
            player.long_actions.push(start_long_act(action));
            revalidate(&mut player.long_actions);
            let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
            for ability in ship.abilities.iter_mut() {
                match ability {
                    Ability::Unknown => {}
                    Ability::Shoot {
                        cooldown_ticks_remaining,
                    } => {
                        mem::swap(cooldown_ticks_remaining, &mut SHOOT_COOLDOWN_MCS.clone());
                    }
                }
            }
        }
    }
    return true;
}

fn revalidate(long_actions: &mut Vec<LongAction>) {
    let mut has_jump = false;
    let mut has_respawn = false;
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
            LongAction::Respawn { .. } => {
                if has_respawn {
                    return None;
                }
                has_respawn = true;
                Some(a)
            }
            LongAction::Shoot { .. } => Some(a),
        })
        .collect();
    mem::swap(long_actions, &mut new_actions);
}

const TRANS_SYSTEM_JUMP_TIME: i32 = 5 * 1000 * 1000;

pub fn start_long_act(act: LongActionStart) -> LongAction {
    return match act {
        LongActionStart::Unknown => LongAction::Unknown { id: new_id() },
        LongActionStart::TransSystemJump { to } => LongAction::TransSystemJump {
            id: new_id(),
            to,
            micro_left: TRANS_SYSTEM_JUMP_TIME,
            percentage: 0,
        },
        LongActionStart::Respawn => LongAction::Respawn {
            id: new_id(),
            micro_left: PLAYER_RESPAWN_TIME_MC,
            percentage: 0,
        },
        LongActionStart::Shoot { target } => LongAction::Shoot {
            id: new_id(),
            target,
            micro_left: combat::SHOOT_DURATION_TICKS,
            percentage: 0,
        },
    };
}

pub fn finish_long_act(state: &mut GameState, player_id: Uuid, act: LongAction) {
    match act {
        LongAction::Unknown { .. } => {
            // nothing to do
        }
        LongAction::TransSystemJump { to, .. } => {
            locations::try_move_player_ship(state, player_id, to);
        }
        LongAction::Respawn { .. } => {
            spawn_ship(state, player_id, None);
        }
        LongAction::Shoot { .. } => {}
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
        LongAction::Respawn { micro_left, id, .. } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Respawn {
                    id,
                    micro_left: left,
                    percentage: calc_percentage(left, PLAYER_RESPAWN_TIME_MC),
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
                    percentage: calc_percentage(left, combat::SHOOT_DURATION_TICKS),
                },
                left > 0,
            )
        }
    };
}

fn calc_percentage(left: i32, max: i32) -> u32 {
    (((max as f32 - left as f32) / max as f32).max(0.0) * 100.0) as u32
}
