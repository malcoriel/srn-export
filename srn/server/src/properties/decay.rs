use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier};
use crate::properties;
use crate::properties::{
    ensure_no_property, ensure_property, replace_property, ObjectProperty, ObjectPropertyKey,
};
use crate::world::{GameState, Location, ProcessProps};

pub fn apply_decay(elapsed_ticks: i32, props: &mut Vec<ObjectProperty>) -> bool {
    let lifetime_expired = if let Some(expiration) =
        properties::find_property_mut(props, ObjectPropertyKey::Lifetime)
    {
        extract!(expiration, ObjectProperty::Lifetime(props) => props.apply(elapsed_ticks))
    } else {
        false
    };
    if lifetime_expired {
        replace_property(
            props,
            ObjectPropertyKey::Lifetime,
            ObjectProperty::Decays(ProcessProps::from(WRECK_DECAY_TICKS)),
        );
    }

    let decay_done =
        if let Some(expiration) = properties::find_property_mut(props, ObjectPropertyKey::Decays) {
            extract!(expiration, ObjectProperty::Decays(props) => props.apply(elapsed_ticks))
        } else {
            false
        };
    decay_done
}

pub fn cleanup_objects(state: &mut GameState, loc_idx: usize) {
    let loc = &mut state.locations[loc_idx];
    loc.projectiles.retain(|p| !*p.get_to_clean());
    loc.wrecks.retain(|w| !w.to_clean);
    loc.asteroids.retain(|w| !w.to_clean);
    loc.explosions.retain(|w| !w.to_clean);
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
    let lifetime_specs = indexes.objects_by_property_type[location_idx]
        .get(&ObjectPropertyKey::Lifetime)
        .unwrap_or(&def_vec);
    for spec in expire_specs {
        apply_decay_to_spec(loc, elapsed_ticks, spec);
    }
    for spec in lifetime_specs {
        apply_decay_to_spec(loc, elapsed_ticks, spec);
    }
}

fn apply_decay_to_spec(loc: &mut Location, elapsed_ticks: i32, spec: &ObjectIndexSpecifier) {
    match spec {
        ObjectIndexSpecifier::Unknown => {}
        ObjectIndexSpecifier::Mineral { .. } => {}
        ObjectIndexSpecifier::Container { .. } => {}
        ObjectIndexSpecifier::AsteroidBelt { .. } => {}
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
        ObjectIndexSpecifier::Explosion { .. } => {
            // will be applied by special update_explosion instead, as it's not only decay
        }
    }
}

pub const WRECK_DECAY_TICKS: i32 = 3 * 1000 * 1000;
pub const PROJECTILE_LIFETIME_TICKS: i32 = 10 * 1000 * 1000;
pub const PROJECTILE_DECAY_TICKS: i32 = 3 * 1000 * 1000;
