use crate::autofocus::SpatialIndex;
use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier};
use crate::world::{GameState, Location, ProcessProps, UpdateOptions};
use serde_derive::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum ObjectProperty {
    Unknown,
    UnlandablePlanet,
    PirateDefencePlayersHomePlanet,
    PirateShip,
    MoneyOnKill { amount: i32 },
    Decays(ProcessProps),
}

#[skip_serializing_none]
#[derive(
    Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, PartialEq, Eq, Hash,
)]
pub enum ObjectPropertyKey {
    Unknown,
    UnlandablePlanet,
    PirateDefencePlayersHomePlanet,
    PirateShip,
    MoneyOnKill,
    Decays,
}

impl ObjectProperty {
    pub fn key(&self) -> ObjectPropertyKey {
        match self {
            ObjectProperty::MoneyOnKill { .. } => ObjectPropertyKey::MoneyOnKill,
            ObjectProperty::Decays { .. } => ObjectPropertyKey::Decays,
            ObjectProperty::Unknown => ObjectPropertyKey::Unknown,
            ObjectProperty::UnlandablePlanet => ObjectPropertyKey::UnlandablePlanet,
            ObjectProperty::PirateDefencePlayersHomePlanet => {
                ObjectPropertyKey::PirateDefencePlayersHomePlanet
            }
            ObjectProperty::PirateShip => ObjectPropertyKey::PirateShip,
        }
    }
}

pub fn update_properties_rules(
    loc: &mut Location,
    _update_options: &UpdateOptions,
    _spatial_index: &mut SpatialIndex,
    indexes: &GameStateIndexes,
    location_idx: usize,
    elapsed_ticks: i32,
) {
    let def_vec = vec![];
    let expire_specs = indexes.objects_by_property_type[location_idx]
        .get(&ObjectPropertyKey::Decays)
        .unwrap_or(&def_vec);
    for spec in expire_specs {
        match spec {
            ObjectIndexSpecifier::Unknown => {}
            ObjectIndexSpecifier::Mineral { .. } => {}
            ObjectIndexSpecifier::Container { .. } => {}
            ObjectIndexSpecifier::Projectile { idx } => {
                if apply_decay(elapsed_ticks, loc.projectiles[*idx].get_properties_mut()) {
                    *loc.projectiles[*idx].get_to_clean_mut() = true;
                }
            }
            ObjectIndexSpecifier::Asteroid { .. } => {}
            ObjectIndexSpecifier::Planet { .. } => {}
            ObjectIndexSpecifier::Ship { .. } => {}
            ObjectIndexSpecifier::Star => {}
            ObjectIndexSpecifier::Wreck { idx } => {
                if apply_decay(elapsed_ticks, &mut loc.wrecks[*idx].properties) {
                    loc.wrecks[*idx].to_clean = true;
                }
            }
        }
    }
}

fn apply_decay(elapsed_ticks: i32, props: &mut Vec<ObjectProperty>) -> bool {
    if let Some(expiration) = find_property_mut(props, ObjectPropertyKey::Decays) {
        extract!(expiration, ObjectProperty::Decays(props) => {
            props.remaining_ticks -= elapsed_ticks;
            if props.remaining_ticks <= 0 {
                true
            } else {
                false
            }
        })
    } else {
        false
    }
}

pub fn cleanup_objects(state: &mut GameState, loc_idx: usize) {
    let loc = &mut state.locations[loc_idx];
    loc.projectiles.retain(|p| !*p.get_to_clean())
}

pub fn find_property(
    props: &Vec<ObjectProperty>,
    key: ObjectPropertyKey,
) -> Option<&ObjectProperty> {
    props.iter().find(|p| p.key() == key)
}

pub fn find_property_mut(
    props: &mut Vec<ObjectProperty>,
    key: ObjectPropertyKey,
) -> Option<&mut ObjectProperty> {
    props.iter_mut().find(|p| p.key() == key).map(|v| v)
}

pub fn has_property(props: &Vec<ObjectProperty>, key: ObjectPropertyKey) -> bool {
    find_property(props, key).is_some()
}
