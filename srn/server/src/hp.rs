use crate::autofocus::{object_index_into_object_id, SpatialIndex};
use crate::combat::{create_explosion, damage_objects, heal_objects, ExplosionProps, Health};
use crate::indexing::{
    index_players_by_ship_id, GameStateIndexes, ObjectIndexSpecifier, ObjectSpecifier,
};
use crate::properties::{has_property, ObjectProperty, ObjectPropertyKey, WRECK_DECAY_TICKS};
use crate::world::{
    GameState, Location, ProcessProps, SpatialProps, Wreck, PLANET_HEALTH_REGEN_PER_TICK,
};
use crate::world_events::GameEvent;
use crate::{indexing, prng_id, world_events};
use rand_pcg::Pcg64Mcg;

pub const SHIP_REGEN_PER_SEC: f64 = 5.0;
const STAR_INSIDE_DAMAGE_PER_SEC: f64 = 50.0;
const STAR_DAMAGE_PER_SEC_NEAR: f64 = 25.0;
const STAR_DAMAGE_PER_SEC_FAR: f64 = 7.5;
const STAR_INSIDE_RADIUS: f64 = 0.5;
const STAR_CLOSE_RADIUS: f64 = 0.68;
const STAR_FAR_RADIUS: f64 = 1.1;
const DMG_EFFECT_MIN: f64 = 5.0;
const HEAL_EFFECT_MIN: f64 = 5.0;

pub fn update_hp_effects(
    state: &mut GameState,
    loc_idx: usize,
    elapsed_micro: i64,
    prng: &mut Pcg64Mcg,
    _client: bool,
    _extra_damages: Vec<(ObjectSpecifier, f64)>,
    _spatial_index: &mut SpatialIndex,
    indexes: &mut GameStateIndexes,
) {
    let state_id = state.id;
    let players_by_ship_id = index_players_by_ship_id(&state.players).clone();

    let mut health_changes = vec![];
    // apply damage from the star
    let star_id = if let Some(star) = state.locations[loc_idx].star.clone() {
        let star_center = star.spatial.position.clone();
        let mut idx = -1;
        for mut ship in state.locations[loc_idx].ships.iter_mut() {
            idx += 1;
            if has_property(&ship.properties, ObjectPropertyKey::Invulnerable) {
                continue;
            }
            let ship_pos = ship.spatial.position.clone();

            let dist_to_star = ship_pos.euclidean_distance(&star_center);
            let rr = dist_to_star / star.spatial.radius;

            let star_damage = if rr < STAR_INSIDE_RADIUS {
                STAR_INSIDE_DAMAGE_PER_SEC
            } else if rr < STAR_CLOSE_RADIUS {
                STAR_DAMAGE_PER_SEC_NEAR
            } else if rr < STAR_FAR_RADIUS {
                STAR_DAMAGE_PER_SEC_FAR
            } else {
                0.0
            };
            //eprintln!("star_damage {}", star_damage);
            let star_damage = star_damage * elapsed_micro as f64 / 1000.0 / 1000.0;

            ship.health.acc_periodic_dmg += star_damage;
            if ship.health.acc_periodic_dmg >= DMG_EFFECT_MIN {
                let dmg_done = ship.health.acc_periodic_dmg.floor() as i32;
                ship.health.acc_periodic_dmg = 0.0;
                health_changes.push((
                    true,
                    ObjectIndexSpecifier::Ship { idx: idx as usize },
                    dmg_done,
                ));
            }

            if star_damage <= 0.0
                && ship.health.current < ship.health.max
                && ship.health.regen_per_tick.is_some()
            {
                let regen = ship.health.regen_per_tick.unwrap_or(0.0) * elapsed_micro as f64;
                ship.health.acc_periodic_heal += regen;
            }

            if ship.health.acc_periodic_heal >= HEAL_EFFECT_MIN {
                let heal = ship.health.acc_periodic_heal.floor() as i32;
                ship.health.acc_periodic_heal = 0.0;
                health_changes.push((
                    false,
                    ObjectIndexSpecifier::Ship { idx: idx as usize },
                    heal,
                ));
            }
        }
        Some(star.id)
    } else {
        None
    };

    for change in health_changes.into_iter() {
        // is damage and not heal

        if change.0 {
            // star damage only here
            if let (Some(id), Some(star_id)) = (
                object_index_into_object_id(&change.1, &state.locations[loc_idx]),
                star_id,
            ) {
                // that's kind of stupid to pass array of 1 item in a loop, but because of coupling with heal which doesn't yet have the effect...
                damage_objects(
                    &mut state.locations[loc_idx],
                    &vec![id],
                    change.2 as f64,
                    &ObjectSpecifier::Star { id: star_id },
                    indexes,
                    state.ticks,
                    prng,
                );
            }
        } else {
            // ship self-regen here
            if let Some(id) = object_index_into_object_id(&change.1, &state.locations[loc_idx]) {
                let id_clone = id.clone();
                heal_objects(
                    &mut state.locations[loc_idx],
                    &vec![id],
                    change.2 as f64,
                    &id_clone,
                    indexes,
                    state.ticks,
                    prng,
                )
            }
        }
    }

    let mut ship_death_effects = vec![];
    for ship in state.locations[loc_idx].ships.iter_mut() {
        if ship.health.current <= 0.0 {
            ship.to_clean = true;
            ship_death_effects.push((ship.clone(), players_by_ship_id.get(&ship.id).map(|p| p.id)));
        }
    }
    for (ship_clone, pid) in ship_death_effects.into_iter() {
        state.locations[loc_idx].wrecks.push(Wreck {
            spatial: SpatialProps {
                position: ship_clone.as_vec(),
                velocity: ship_clone.spatial.velocity.clone().scalar_mul(0.25),
                angular_velocity: 0.0,
                rotation_rad: ship_clone.spatial.rotation_rad,
                radius: ship_clone.spatial.radius,
            },
            id: prng_id(prng),
            color: ship_clone.color.clone(),
            properties: vec![ObjectProperty::Decays(ProcessProps::from(
                WRECK_DECAY_TICKS,
            ))],
            to_clean: false,
        });
        create_explosion(
            &ExplosionProps {
                damage: 10.0,
                radius: 5.0,
                applied_force: 6e-12,
                spread_speed: 1e-5,
            },
            &ship_clone.spatial.position,
            &mut state.locations[loc_idx],
            None,
            indexes,
            loc_idx,
        );
        let event =
            if let Some(player) = pid.and_then(|pid| indexing::find_my_player_mut(state, pid)) {
                player.ship_id = None;
                player.money -= 1000;
                player.money = player.money.max(0);
                GameEvent::ShipDied {
                    state_id,
                    ship: ship_clone,
                    player_id: Some(player.id),
                }
            } else {
                GameEvent::ShipDied {
                    state_id,
                    ship: ship_clone,
                    player_id: None,
                }
            };
        world_events::fire_saved_event(state, event);
    }

    for planet in state.locations[loc_idx].planets.iter_mut() {
        if let Some(health) = &mut planet.health {
            if health.current < health.max {
                health.current += PLANET_HEALTH_REGEN_PER_TICK * elapsed_micro as f64;
                health.current = health.current.min(health.max);
            }
        }
    }

    let mut exploded_projectiles = vec![];
    for i in 0..state.locations[loc_idx].projectiles.len() {
        let projectile = &mut state.locations[loc_idx].projectiles[i];
        let blow = if let Some(health) = projectile.get_health_mut() {
            health.current <= 0.0
        } else {
            false
        };
        if blow {
            if let Some(exp_props) = projectile.get_explosion_props() {
                exploded_projectiles.push((
                    Some(projectile.get_id()),
                    exp_props.clone(),
                    projectile.get_spatial().position,
                ));
            }
            *projectile.get_to_clean_mut() = true;
        }
    }
    for blown in exploded_projectiles.into_iter() {
        create_explosion(
            &blown.1,
            &blown.2,
            &mut state.locations[loc_idx],
            blown.0,
            indexes,
            loc_idx,
        );
    }
}

pub fn object_index_into_health_mut<'a, 'b>(
    ois: &'a ObjectIndexSpecifier,
    loc: &'b mut Location,
) -> Option<&'b mut Health> {
    match ois {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { .. } => None,
        ObjectIndexSpecifier::Container { .. } => None,
        ObjectIndexSpecifier::Planet { idx } => loc.planets.get_mut(*idx).and_then(|o| {
            if has_property(&o.properties, ObjectPropertyKey::Invulnerable) {
                return None;
            }
            o.health.as_mut()
        }),
        ObjectIndexSpecifier::Ship { idx } => loc.ships.get_mut(*idx).and_then(|ship| {
            if has_property(&ship.properties, ObjectPropertyKey::Invulnerable) {
                return None;
            }
            Some(&mut ship.health)
        }),
        ObjectIndexSpecifier::Star => None,
        ObjectIndexSpecifier::Projectile { idx } => loc.projectiles.get_mut(*idx).and_then(|p| {
            // Let's ignore Invulnerable for projectiles for now, as they simply can have no health
            // if has_property(&p.get_properties(), ObjectPropertyKey::Invulnerable) {
            //     return None;
            // }
            p.get_health_mut()
        }),
        ObjectIndexSpecifier::Asteroid { idx } => loc
            .asteroids
            .get_mut(*idx)
            .and_then(|a| Some(&mut a.health)),
        ObjectIndexSpecifier::Wreck { .. } => None,
        ObjectIndexSpecifier::Explosion { .. } => None,
        ObjectIndexSpecifier::AsteroidBelt { .. } => None,
    }
}

pub fn object_index_into_to_clean_mut<'a, 'b>(
    ois: &'a ObjectIndexSpecifier,
    loc: &'b mut Location,
) -> Option<&'b mut bool> {
    match ois {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { .. } => None,
        ObjectIndexSpecifier::Container { .. } => None,
        ObjectIndexSpecifier::Planet { .. } => None,
        ObjectIndexSpecifier::Ship { idx } => loc.ships.get_mut(*idx).and_then(|ship| {
            if has_property(&ship.properties, ObjectPropertyKey::Invulnerable) {
                return None;
            }
            Some(&mut ship.to_clean)
        }),
        ObjectIndexSpecifier::Star => None,
        ObjectIndexSpecifier::Projectile { idx } => loc
            .projectiles
            .get_mut(*idx)
            .and_then(|p| Some(p.get_to_clean_mut())),
        ObjectIndexSpecifier::Asteroid { idx } => loc
            .asteroids
            .get_mut(*idx)
            .and_then(|a| Some(&mut a.to_clean)),
        ObjectIndexSpecifier::Wreck { .. } => None,
        ObjectIndexSpecifier::Explosion { .. } => None,
        ObjectIndexSpecifier::AsteroidBelt { .. } => None,
    }
}
