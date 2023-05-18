use crate::autofocus::SpatialIndex;
use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier};
use crate::world::{GameState, Location, UpdateOptions};
use serde_derive::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[skip_serializing_none]
#[derive(
    Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, PartialEq, Eq, Hash,
)]
#[serde(tag = "tag")]
pub enum ObjectProperty {
    Unknown,
    UnlandablePlanet,
    PirateDefencePlayersHomePlanet,
    PirateShip,
    MoneyOnKill { amount: i32 },
    Expires { remaining_ticks: i32 },
}

impl ObjectProperty {
    pub fn key(&self) -> ObjectProperty {
        match self {
            ObjectProperty::MoneyOnKill { .. } => ObjectProperty::MoneyOnKill { amount: 0 },
            ObjectProperty::Expires { .. } => ObjectProperty::Expires { remaining_ticks: 0 },
            _ => self.clone(),
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
        .get(&ObjectProperty::Expires { remaining_ticks: 0 })
        .unwrap_or(&def_vec);
    for spec in expire_specs {
        match spec {
            ObjectIndexSpecifier::Unknown => {}
            ObjectIndexSpecifier::Mineral { .. } => {}
            ObjectIndexSpecifier::Container { .. } => {}
            ObjectIndexSpecifier::Projectile { idx } => {
                let props = loc.projectiles[*idx].get_properties_mut();
                let to_clean = if let Some(expiration) = props
                    .iter_mut()
                    .find(|p| matches!(p, ObjectProperty::Expires { .. }))
                {
                    match expiration {
                        ObjectProperty::Expires {
                            remaining_ticks, ..
                        } => {
                            *remaining_ticks -= elapsed_ticks;
                            if *remaining_ticks <= 0 {
                                true
                            } else {
                                false
                            }
                        }
                        _ => false,
                    }
                } else {
                    false
                };
                if to_clean {
                    *loc.projectiles[*idx].get_to_clean_mut() = to_clean;
                }
            }
            ObjectIndexSpecifier::Asteroid { .. } => {}
            ObjectIndexSpecifier::Planet { .. } => {}
            ObjectIndexSpecifier::Ship { .. } => {}
            ObjectIndexSpecifier::Star => {}
        }
    }
}

pub fn cleanup_objects(state: &mut GameState, loc_idx: usize) {
    let loc = &mut state.locations[loc_idx];
    loc.projectiles.retain(|p| !*p.get_to_clean())
}
