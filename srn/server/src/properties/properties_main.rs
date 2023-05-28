use crate::autofocus::SpatialIndex;
use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier};
use crate::properties::decay;
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
    decay::update_decay(loc, indexes, location_idx, elapsed_ticks, &def_vec);
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
