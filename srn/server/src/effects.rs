use crate::indexing::ObjectSpecifier;
use crate::vec2::Vec2f64;
use crate::world::Location;
use serde_derive::{Deserialize, Serialize};
use strum::AsStaticRef;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

pub fn add_effect(
    eff: LocalEffectCreate,
    from: ObjectSpecifier,
    extra_from_id: Option<u32>, // for something like turret id, to separate damage from each turret, or item id in container
    to: ObjectSpecifier,
    loc: &mut Location,
    current_tick: u32,
) {
    let key = form_effect_key(from, to, &eff, extra_from_id);
    if eff.is_updateable() {
        if let Some(existing) = loc
            .effects
            .iter_mut()
            .find(|e| e.get_key().map_or(false, |k| *k == key))
        {
            existing.update(eff, current_tick);
            return;
        }
    }
    loc.effects.push(match eff {
        LocalEffectCreate::DmgDone { hp } => LocalEffect::DmgDone {
            hp,
            key,
            last_tick: current_tick,
            position: Default::default(),
        },
        LocalEffectCreate::Heal { hp } => LocalEffect::Heal {
            hp,
            key,
            last_tick: current_tick,
            position: Default::default(),
        },
        LocalEffectCreate::PickUp { text } => LocalEffect::PickUp {
            text,
            key,
            last_tick: current_tick,
            position: Default::default(),
        },
    })
}

fn form_effect_key(
    from: ObjectSpecifier,
    to: ObjectSpecifier,
    eff: &LocalEffectCreate,
    extra_from_id: Option<u32>,
) -> String {
    format!(
        "{}:{}:{}{}",
        match eff {
            LocalEffectCreate::DmgDone { .. } => "D",
            LocalEffectCreate::Heal { .. } => "H",
            LocalEffectCreate::PickUp { .. } => "P",
        },
        from.as_static(),
        to.as_static(),
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
        last_tick: u32,
        position: Vec2f64,
    },
    Heal {
        hp: i32,
        key: String,
        last_tick: u32,
        position: Vec2f64,
    },
    PickUp {
        key: String,
        text: String,
        last_tick: u32,
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
}

impl LocalEffect {
    pub fn update(&mut self, eff: LocalEffectCreate, current_tick: u32) {
        // assumes that the target eff was already properly matched by key-matching
        match self {
            LocalEffect::DmgDone { hp, last_tick, .. } => {
                extract!(eff, LocalEffectCreate::DmgDone { hp: new_hp } => {
                    *hp += new_hp;
                });
                *last_tick = current_tick as u32;
            }
            LocalEffect::Heal { hp, last_tick, .. } => {
                extract!(eff, LocalEffectCreate::Heal { hp: new_hp } => {
                    *hp += new_hp;
                });
                *last_tick = current_tick as u32;
            }
            // Cannot be updated
            _ => {}
        }
    }
}
