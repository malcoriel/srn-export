use wasm_bindgen::prelude::*;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use uuid::Uuid;
use serde_derive::{Deserialize, Serialize};
use crate::world::{GameState, find_my_player_mut};
use crate::{locations, new_id};
use core::mem;

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongActionStart {
    Unknown,
    TransSystemJump {
        to: Uuid
    }
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
        micro_left: i64,
        percentage: u32,
    }
}

pub fn try_start_long_action(state: &mut GameState, player_id: Uuid, action: LongActionStart) -> bool {
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
    }
    return true;
}

fn revalidate(long_actions: &mut Vec<LongAction>) {
    let mut has_jump = false;
    let mut new_actions = long_actions.clone().into_iter().filter_map(|a| {
        match a {
            LongAction::Unknown { .. } => {
                Some(a)
            }
            LongAction::TransSystemJump { .. } => {
                if has_jump {
                    return None;
                }
                has_jump = true;
                Some(a)
            }
        }
    }).collect();
    mem::swap(long_actions, &mut new_actions);
}

const TRANS_SYSTEM_JUMP_TIME: i64 = 5 * 1000 * 1000;

pub fn start_long_act(act: LongActionStart) -> LongAction {
    return match act {
        LongActionStart::Unknown => {
            LongAction::Unknown {
                id: new_id()
            }
        }
        LongActionStart::TransSystemJump { to } => {
            LongAction::TransSystemJump {
                id: new_id(),
                to,
                micro_left: TRANS_SYSTEM_JUMP_TIME,
                percentage: 0
            }
        }
    }
}

pub fn finish_long_act(state: &mut GameState, player_id: Uuid, act: LongAction) {
    match act {
        LongAction::Unknown { .. } => {
            // nothing to do
        }
        LongAction::TransSystemJump { to, .. } => {
            locations::try_move_player_ship(state, player_id, to);
        }
    }
}

// (update_action, keep_ticking)
pub fn tick_long_act(act: LongAction, micro_passed: i64) -> (LongAction, bool) {
    return match act {
        LongAction::Unknown { id } => {
            (LongAction::Unknown {
               id,
           }, false)
        }
        LongAction::TransSystemJump { to, id, micro_left, .. } => {
            let left = micro_left - micro_passed;
            let percentage = (((TRANS_SYSTEM_JUMP_TIME as f64 - left as f64) / TRANS_SYSTEM_JUMP_TIME as f64).max(0.0) * 100.0) as u32;
            (LongAction::TransSystemJump {
                id,
                to,
                micro_left: left,
                percentage
            }, left > 0)
        }
    }
}
