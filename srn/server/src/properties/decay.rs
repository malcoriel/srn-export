use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier};
use crate::properties;
use crate::properties::{ObjectProperty, ObjectPropertyKey};
use crate::world::{GameState, Location};

pub fn apply_decay(elapsed_ticks: i32, props: &mut Vec<ObjectProperty>) -> bool {
    if let Some(expiration) = properties::find_property_mut(props, ObjectPropertyKey::Decays) {
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
    loc.projectiles.retain(|p| !*p.get_to_clean());
    loc.wrecks.retain(|w| !w.to_clean);
}

pub fn update_decay(
    loc: &mut Location,
    indexes: &GameStateIndexes,
    location_idx: usize,
    elapsed_ticks: i32,
    def_vec: &Vec<ObjectIndexSpecifier>,
) {
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
