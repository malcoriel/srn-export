use crate::autofocus::SpatialIndex;
use crate::combat::{create_explosion, Health};
use crate::indexing::{index_players_by_ship_id, ObjectIndexSpecifier, ObjectSpecifier};
use crate::properties::{ObjectProperty, WRECK_DECAY_TICKS};
use crate::world::{
    GameState, LocalEffect, Location, ProcessProps, SpatialProps, Wreck,
    PLANET_HEALTH_REGEN_PER_TICK,
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
const MAX_LOCAL_EFF_LIFE_MS: i32 = 10 * 1000;
const DMG_EFFECT_MIN: f64 = 5.0;
const HEAL_EFFECT_MIN: f64 = 5.0;

pub fn update_hp_effects(
    state: &mut GameState,
    location_idx: usize,
    elapsed_micro: i64,
    current_tick: u32,
    prng: &mut Pcg64Mcg,
    client: bool,
    _extra_damages: Vec<(ObjectSpecifier, f64)>,
    _spatial_index: &mut SpatialIndex,
) {
    let state_id = state.id;
    let players_by_ship_id = index_players_by_ship_id(&state.players).clone();

    // apply damage from the star
    if let Some(star) = state.locations[location_idx].star.clone() {
        let star_center = star.spatial.position.clone();
        for mut ship in state.locations[location_idx].ships.iter_mut() {
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
                ship.health.current = (ship.health.current - dmg_done as f64).max(0.0);
                if client {
                    ship.local_effects_counter = (ship.local_effects_counter + 1) % u32::MAX;
                    ship.local_effects.push(LocalEffect::DmgDone {
                        id: ship.local_effects_counter,
                        hp: -dmg_done,
                        tick: current_tick,
                        ship_id: ship.id,
                    });
                }
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
                ship.health.current = ship.health.max.min(ship.health.current + heal as f64);
                if client {
                    ship.local_effects_counter = (ship.local_effects_counter + 1) % u32::MAX;
                    ship.local_effects.push(LocalEffect::Heal {
                        id: ship.local_effects_counter,
                        hp: heal as i32,
                        tick: current_tick,
                        ship_id: ship.id,
                    });
                }
            }

            if client {
                ship.local_effects = ship
                    .local_effects
                    .iter()
                    .filter(|e| {
                        if let Some(tick) = match &e {
                            LocalEffect::Unknown { .. } => None,
                            LocalEffect::DmgDone { tick, .. } => Some(tick),
                            LocalEffect::Heal { tick, .. } => Some(tick),
                            LocalEffect::PickUp { tick, .. } => Some(tick),
                        } {
                            return (*tick as i32 - current_tick as i32).abs()
                                < MAX_LOCAL_EFF_LIFE_MS;
                        }
                        return false;
                    })
                    .map(|e| e.clone())
                    .collect::<Vec<_>>()
            }
        }
    }

    let mut ships_to_die = vec![];
    state.locations[location_idx].ships = state.locations[location_idx]
        .ships
        .iter()
        .filter_map(|ship| {
            if ship.health.current > 0.0 {
                Some(ship.clone())
            } else {
                ships_to_die.push((ship.clone(), players_by_ship_id.get(&ship.id).map(|p| p.id)));
                None
            }
        })
        .collect::<Vec<_>>();
    for (ship_clone, pid) in ships_to_die.into_iter() {
        state.locations[location_idx].wrecks.push(Wreck {
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

    for planet in state.locations[location_idx].planets.iter_mut() {
        if let Some(health) = &mut planet.health {
            if health.current < health.max {
                health.current += PLANET_HEALTH_REGEN_PER_TICK * elapsed_micro as f64;
                health.current = health.current.min(health.max);
            }
        }
    }

    let mut exp = vec![];
    for i in 0..state.locations[location_idx].projectiles.len() {
        let projectile = &mut state.locations[location_idx].projectiles[i];
        let blow = if let Some(health) = projectile.get_health_mut() {
            health.current < 0.0
        } else {
            false
        };
        if blow {
            if let Some(exp_props) = projectile.get_explosion_props() {
                exp.push((
                    Some(projectile.get_id()),
                    exp_props.clone(),
                    projectile.get_spatial().position,
                ));
            }
            *projectile.get_to_clean_mut() = true;
        }
    }
    for blown in exp.into_iter() {
        create_explosion(
            &blown.1,
            &blown.2,
            &mut state.locations[location_idx],
            blown.0,
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
        ObjectIndexSpecifier::Planet { idx } => {
            loc.planets.get_mut(*idx).and_then(|o| o.health.as_mut())
        }
        ObjectIndexSpecifier::Ship { idx } => loc.ships.get_mut(*idx).map(|ship| &mut ship.health),
        ObjectIndexSpecifier::Star => None,
        ObjectIndexSpecifier::Projectile { idx } => loc
            .projectiles
            .get_mut(*idx)
            .and_then(|p| p.get_health_mut()),
        ObjectIndexSpecifier::Asteroid { .. } => None,
        ObjectIndexSpecifier::Wreck { .. } => None,
        ObjectIndexSpecifier::Explosion { .. } => None,
    }
}
