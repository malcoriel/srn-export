use wasm_bindgen::prelude::*;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use uuid::Uuid;
use serde_derive::{Deserialize, Serialize};
use crate::world::{GameState, find_my_player_mut};
use crate::locations;

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongAction {
    Unknown,
    TransSystemJump {
        to: Uuid
    }
}

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongActProgress {
    Unknown,
    TransSystemJump {
        to: Uuid,
        micro_left: i64
    }
}

pub fn try_start_long_action(state: &mut GameState, player_id: Uuid, action: LongAction) -> bool {
    match action {
        LongAction::Unknown => {
            return false;
        }
        LongAction::TransSystemJump { to } => {
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

fn revalidate(_long_actions: &mut Vec<LongActProgress>) {
    return;
}

const TRANS_SYSTEM_JUMP_TIME: i64 = 5 * 1000 * 1000;

fn start_long_act(act: LongAction) -> LongActProgress {
    return match act {
        LongAction::Unknown => {
            LongActProgress::Unknown
        }
        LongAction::TransSystemJump { to } => {
            LongActProgress::TransSystemJump {
                to,
                micro_left: TRANS_SYSTEM_JUMP_TIME
            }
        }
    }
}

fn finish_long_act(state: &mut GameState, player_id: Uuid, act: LongActProgress) {
    match act {
        LongActProgress::Unknown => {
            // do nothing
        }
        LongActProgress::TransSystemJump { to, .. } => {
            locations::try_move_player_ship(state, player_id, to);
        }
    }
}
