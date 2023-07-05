use crate::autofocus::{object_index_into_object_pos, object_index_into_object_radius};
use crate::indexing::{GameStateIndexes, ObjectSpecifier};
use crate::vec2::Vec2f64;
use crate::world::{GameState, Location};
use serde_derive::{Deserialize, Serialize};
use strum::AsStaticRef;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

const LOCAL_EFFECT_UPDATE_PROXIMITY: f64 = 1.0;

pub fn add_effect(
    eff: LocalEffectCreate,
    from: ObjectSpecifier,
    extra_from_id: Option<i32>, // for something like turret id, to separate damage from each turret, or item id in container
    to: ObjectSpecifier,
    loc: &mut Location,
    indexes: &GameStateIndexes,
    current_tick: u64,
) {
    let key = form_effect_key(&from, &to, &eff, extra_from_id);
    let effect_pos = calculate_effect_position(&from, &to, loc, indexes, false);
    if let Some(effect_pos) = effect_pos {
        // I've tried and it kind of looks cool, but it doesn't look good enough for now, and requires constant position update
        // if eff.is_updateable() {
        //     if let Some(existing) = loc
        //         .effects
        //         .iter_mut()
        //         .find(|e| e.get_key().map_or(false, |k| {
        //             let same_key = *k == key;
        //             if !same_key {
        //                 return false;
        //             }
        //             return true;
        //         }))
        //     {
        //         existing.update(eff, current_tick, effect_pos);
        //         return;
        //     }
        // }
        loc.effects.push(match eff {
            LocalEffectCreate::DmgDone { hp } => LocalEffect::DmgDone {
                hp,
                key,
                last_tick: current_tick,
                position: effect_pos,
            },
            LocalEffectCreate::Heal { hp } => LocalEffect::Heal {
                hp,
                key,
                last_tick: current_tick,
                position: effect_pos,
            },
            LocalEffectCreate::PickUp { text } => LocalEffect::PickUp {
                text,
                key,
                last_tick: current_tick,
                position: effect_pos,
            },
        })
    } else {
        warn2!("Attempt to add effect without position for from:{from:?} to:{to:?}");
    }
}

fn calculate_effect_position(
    from: &ObjectSpecifier,
    to: &ObjectSpecifier,
    loc: &Location,
    indexes: &GameStateIndexes,
    _debug: bool,
) -> Option<Vec2f64> {
    if let (Some(from_pos), Some(to_pos), Some(from_rad), Some(to_rad)) = (
        indexes
            .reverse_id_index
            .get(from)
            .and_then(|ois| object_index_into_object_pos(ois, loc)),
        indexes
            .reverse_id_index
            .get(to)
            .and_then(|ois| object_index_into_object_pos(ois, loc)),
        indexes
            .reverse_id_index
            .get(from)
            .and_then(|ois| object_index_into_object_radius(ois, loc)),
        indexes
            .reverse_id_index
            .get(to)
            .and_then(|ois| object_index_into_object_radius(ois, loc)),
    ) {
        if from == to {
            let up = Vec2f64 { x: 0.0, y: 1.0 }.scalar_mul(from_rad);
            return Some(from_pos.add(&up));
        }
        let dist = from_pos.euclidean_distance(&to_pos);
        if dist.abs() <= 1e-6 {
            // So close that it doesn't matter, just return receiver position - it's likely the same obj
            return Some(to_pos);
        }
        // otherwise, position near the edge of the receiver, unwrap is safe because dist is > 0
        let reverse_dir = from_pos
            .subtract(&to_pos)
            .normalize()
            .unwrap()
            .scalar_mul(to_rad);
        return Some(to_pos.add(&reverse_dir));
    }
    return None;
}

fn form_effect_key(
    from: &ObjectSpecifier,
    to: &ObjectSpecifier,
    eff: &LocalEffectCreate,
    extra_from_id: Option<i32>,
) -> String {
    format!(
        "{}:{}:{}:{}",
        match eff {
            LocalEffectCreate::DmgDone { .. } => "D",
            LocalEffectCreate::Heal { .. } => "H",
            LocalEffectCreate::PickUp { .. } => "P",
        },
        from,
        to,
        extra_from_id.map_or("".to_string(), |i| format!(":{}", i))
    )
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LocalEffectCreate {
    DmgDone { hp: i32 },
    Heal { hp: i32 },
    PickUp { text: String },
}

impl LocalEffectCreate {
    // should be in sync with LocalEffect's update
    pub fn is_updateable(&self) -> bool {
        match self {
            LocalEffectCreate::DmgDone { .. } => true,
            LocalEffectCreate::Heal { .. } => true,
            _ => false,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum LocalEffect {
    Unknown {},
    DmgDone {
        hp: i32,
        key: String,
        last_tick: u64,
        position: Vec2f64,
    },
    Heal {
        hp: i32,
        key: String,
        last_tick: u64,
        position: Vec2f64,
    },
    PickUp {
        key: String,
        text: String,
        last_tick: u64,
        position: Vec2f64,
    },
}

impl LocalEffect {
    pub fn get_key(&self) -> Option<&String> {
        match self {
            LocalEffect::Unknown { .. } => None,
            LocalEffect::DmgDone { key, .. } => Some(&key),
            LocalEffect::Heal { key, .. } => Some(&key),
            LocalEffect::PickUp { key, .. } => Some(&key),
        }
    }

    pub fn get_tick(&self) -> Option<u64> {
        match self {
            LocalEffect::Unknown { .. } => None,
            LocalEffect::DmgDone { last_tick, .. } => Some(*last_tick),
            LocalEffect::Heal { last_tick, .. } => Some(*last_tick),
            LocalEffect::PickUp { last_tick, .. } => Some(*last_tick),
        }
    }
}

impl LocalEffect {
    pub fn update(&mut self, eff: LocalEffectCreate, current_tick: u64, new_pos: Vec2f64) {
        // assumes that the target eff was already properly matched by key-matching
        match self {
            LocalEffect::DmgDone {
                hp,
                last_tick,
                position,
                ..
            } => {
                extract!(eff, LocalEffectCreate::DmgDone { hp: new_hp } => {
                    *hp += new_hp;
                });
                *last_tick = current_tick;
                *position = new_pos;
            }
            LocalEffect::Heal {
                hp,
                last_tick,
                position,
                ..
            } => {
                extract!(eff, LocalEffectCreate::Heal { hp: new_hp } => {
                    *hp += new_hp;
                });
                *last_tick = current_tick;
                *position = new_pos;
            }
            // Cannot be updated
            _ => {}
        }
    }
}

const MAX_LOCAL_EFFECT_LIFE_MS: i64 = 2 * 1000;

pub fn cleanup_effects(state: &mut GameState, loc_idx: usize) {
    let curr_ticks = state.ticks as i64;
    state.locations[loc_idx].effects.retain(|eff| {
        return eff.get_tick().map_or(false, |tick| {
            (curr_ticks - tick as i64).abs() < MAX_LOCAL_EFFECT_LIFE_MS * 1000 as i64
        });
    });
}
