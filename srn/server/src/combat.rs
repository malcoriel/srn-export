use rand_pcg::Pcg64Mcg;
use serde_derive::{Deserialize, Serialize};
use std::f64::consts::PI;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::abilities::Ability;
use crate::autofocus::{object_index_into_object_id, SpatialIndex};
use crate::indexing::{
    find_my_player_mut, find_my_ship_index, find_my_ship_mut, find_spatial_ref_by_spec,
    GameStateIndexes, ObjectIndexSpecifier, ObjectSpecifier,
};
use crate::planet_movement::project_body_relative_position;
use crate::random_stuff::generate_normal_random;
use crate::spatial_movement::align_rotation_with_velocity;
use crate::vec2::Vec2f64;
use crate::world::{
    remove_object, GameState, LocalEffect, Location, Player, Projectile, Ship, SpatialProps,
    TemplateId, UpdateOptions,
};
use crate::{indexing, new_id, world};

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Copy)]
#[serde(tag = "tag")]
pub enum ShootTarget {
    Unknown,
    Ship { id: Uuid },
    Mineral { id: Uuid },
    Asteroid { id: Uuid },
    Container { id: Uuid },
}

impl ShootTarget {
    pub fn to_specifier(&self) -> Option<ObjectSpecifier> {
        return match &self {
            ShootTarget::Unknown => None,
            ShootTarget::Ship { id } => Some(ObjectSpecifier::Ship { id: *id }),
            ShootTarget::Mineral { id } => Some(ObjectSpecifier::Mineral { id: *id }),
            ShootTarget::Asteroid { id } => Some(ObjectSpecifier::Asteroid { id: *id }),
            ShootTarget::Container { id } => Some(ObjectSpecifier::Container { id: *id }),
        };
    }
}

impl Default for ShootTarget {
    fn default() -> Self {
        ShootTarget::Unknown
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify, Default)]
pub struct Health {
    pub current: f64,
    pub max: f64,
    pub regen_per_tick: Option<f64>,
    pub last_damage_dealer: Option<ObjectSpecifier>,
}

impl Health {
    pub fn new(max: f64) -> Health {
        Health {
            current: max,
            max,
            regen_per_tick: None,
            last_damage_dealer: None,
        }
    }

    pub fn new_regen(max: f64, regen_per_tick: f64) -> Health {
        Health {
            current: max,
            max,
            regen_per_tick: Some(regen_per_tick),
            last_damage_dealer: None,
        }
    }
}

pub fn validate_shoot(
    target: ShootTarget,
    loc: &Location,
    ship: &Ship,
    active_turret_id: String,
) -> bool {
    let shoot_ability = find_turret_ability(ship, active_turret_id);
    if shoot_ability.is_none() {
        return false;
    }
    let shoot_ability = shoot_ability.unwrap();

    if shoot_ability.get_current_cooldown() > 0 {
        return false;
    }
    match target {
        ShootTarget::Unknown => {}
        ShootTarget::Ship { .. } => {}
        ShootTarget::Mineral { id } => {
            if let Some(min) = indexing::find_mineral(loc, id) {
                let min_pos = Vec2f64 { x: min.x, y: min.y };
                if !check_distance(ship, shoot_ability, min_pos) {
                    return false;
                }
            } else {
                return false;
            }
        }
        ShootTarget::Container { id } => {
            if let Some(cont) = indexing::find_container(loc, id) {
                if !check_distance(ship, shoot_ability, cont.position) {
                    return false;
                }
            } else {
                return false;
            }
        }
        ShootTarget::Asteroid { id } => {
            if let Some(ast) = indexing::find_asteroid(loc, id) {
                if !check_distance(ship, shoot_ability, ast.spatial.position) {
                    return false;
                }
            } else {
                return false;
            }
        }
    };
    return true;
}

pub fn validate_launch(
    _target: ShootTarget,
    _loc: &Location,
    ship: &Ship,
    active_turret_id: String,
) -> bool {
    let shoot_ability = find_turret_ability(ship, active_turret_id);
    if shoot_ability.is_none() {
        return false;
    }
    let shoot_ability = shoot_ability.unwrap();

    if shoot_ability.get_current_cooldown() > 0 {
        return false;
    }
    // no distance checking, because you can launch even if it's too far
    return true;
}

pub fn find_turret_ability(ship: &Ship, active_turret_id: String) -> Option<&Ability> {
    ship.abilities.iter().find(|a| match a {
        Ability::Shoot { turret_id, .. } => *turret_id == active_turret_id,
        Ability::Launch { turret_id, .. } => *turret_id == active_turret_id,
        _ => false,
    })
}

fn check_distance(ship: &Ship, shoot_ability: &Ability, min_pos: Vec2f64) -> bool {
    let ship_pos = ship.spatial.position.clone();
    if min_pos.euclidean_distance(&ship_pos) > shoot_ability.get_distance() {
        return false;
    }
    return true;
}

pub const SHIP_SHOOT_STRENGTH: f64 = 20.0;

pub fn resolve_shoot(
    state: &mut GameState,
    player_shooting: Uuid,
    target: ShootTarget,
    active_turret_id: String,
    client: bool,
) {
    if let Some(ship_loc) = find_my_ship_index(state, player_shooting) {
        let loc = &state.locations[ship_loc.location_idx];
        let shooting_ship = &loc.ships[ship_loc.ship_idx];
        let shooting_ship_id = shooting_ship.id;
        let shoot_ability = find_turret_ability(shooting_ship, active_turret_id);
        if shoot_ability.is_none() {
            return;
        }
        let shoot_ability = shoot_ability.unwrap();

        match target {
            ShootTarget::Unknown => {}
            ShootTarget::Ship { id: target_ship_id } => {
                let dmg = SHIP_SHOOT_STRENGTH;
                let target_ship = state.locations[ship_loc.location_idx]
                    .ships
                    .iter_mut()
                    .find(|s| s.id == target_ship_id);
                if let Some(target_ship) = target_ship {
                    target_ship.health.current -= dmg;
                    target_ship.health.last_damage_dealer = Some(ObjectSpecifier::Ship {
                        id: shooting_ship_id,
                    });
                    target_ship.local_effects_counter =
                        (target_ship.local_effects_counter + 1) % u32::MAX;
                    let effect = LocalEffect::DmgDone {
                        id: target_ship.local_effects_counter,
                        hp: dmg as i32,
                        ship_id: target_ship_id,
                        tick: state.millis,
                    };

                    if client {
                        target_ship.local_effects.push(effect.clone())
                    }
                }
            }
            ShootTarget::Mineral { id } => {
                if let Some(min) = indexing::find_mineral(loc, id) {
                    let min_pos = Vec2f64 { x: min.x, y: min.y };
                    if !check_distance(shooting_ship, shoot_ability, min_pos) {
                        return;
                    }
                    remove_object(
                        state,
                        ship_loc.location_idx,
                        ObjectSpecifier::Mineral { id },
                    )
                } else {
                    return;
                }
            }
            ShootTarget::Container { id } => {
                if let Some(cont) = indexing::find_container(loc, id) {
                    if !check_distance(shooting_ship, shoot_ability, cont.position) {
                        return;
                    }
                    remove_object(
                        state,
                        ship_loc.location_idx,
                        ObjectSpecifier::Container { id },
                    )
                } else {
                    return;
                }
            }
            ShootTarget::Asteroid { id } => {
                if let Some(ast) = indexing::find_asteroid(loc, id) {
                    if !check_distance(shooting_ship, shoot_ability, ast.spatial.position) {
                        return;
                    }
                    remove_object(
                        state,
                        ship_loc.location_idx,
                        ObjectSpecifier::Asteroid { id },
                    )
                } else {
                    return;
                }
            }
        }
    }
}

pub fn resolve_launch(
    state: &mut GameState,
    player_shooting: Uuid,
    target: ShootTarget,
    active_turret_id: String,
    _client: bool,
    indexes: &GameStateIndexes,
    prng: &mut Pcg64Mcg,
) {
    let spec = target.to_specifier();
    if spec.is_none() {
        warn!("no target spec");
        return;
    }
    let spec = spec.unwrap();
    let target_pos = find_spatial_ref_by_spec(indexes, spec.clone());
    if target_pos.is_none() {
        warn!(format!("no target pos: {:?}", spec));
        return;
    }
    let target_pos = target_pos.unwrap().clone();

    if let Some(ship_loc) = find_my_ship_index(state, player_shooting) {
        let loc = &mut state.locations[ship_loc.location_idx];
        let shooting_ship = &mut loc.ships[ship_loc.ship_idx];
        let launch_ability = find_turret_ability(shooting_ship, active_turret_id);
        if launch_ability.is_none() {
            return;
        }
        let launch_ability = launch_ability.unwrap();
        let proj_template_id = match launch_ability {
            Ability::Launch {
                projectile_template_id,
                ..
            } => Some(projectile_template_id),
            _ => None,
        };
        if proj_template_id.is_none() {
            return;
        }
        let proj_template_id = proj_template_id.unwrap();
        let proj_template = if let Some(proj_templates) = &state.projectile_templates {
            proj_templates
                .iter()
                .find(|t| t.get_id() == *proj_template_id)
        } else {
            None
        };
        if proj_template.is_none() {
            return;
        }
        let proj_template = proj_template.unwrap();

        let mut instance = proj_template.clone();
        loc.projectile_counter = (loc.projectile_counter + 1) % i32::MAX;
        instance.set_id(loc.projectile_counter);
        instance.set_position_from(&shooting_ship.spatial.position);
        instance.set_target(&target);
        let mut new_rot = shooting_ship.spatial.rotation_rad;
        let deviation = generate_normal_random(0.0, 0.15, prng);
        new_rot -= deviation;
        let new_velocity = Vec2f64 { x: 0.0, y: 1.0 }.rotate(new_rot);
        let mut new_velocity =
            new_velocity.scalar_mul(proj_template.get_spatial().velocity.euclidean_len());
        // ensure that new projectile is not launched inside the ship, as otherwise it can collide and blow immediately
        instance.get_spatial_mut().position = instance.get_spatial().position.add(
            &new_velocity
                .normalize()
                .expect("new velocity should be non-zero")
                .scalar_mul(shooting_ship.spatial.radius + proj_template.get_spatial().radius),
        );
        instance.get_spatial_mut().velocity = new_velocity;
        instance.get_spatial_mut().rotation_rad = new_rot;
        loc.projectiles.push(instance);
    }
}

pub fn guide_projectile(proj: &mut Projectile, target_spatial: &SpatialProps, elapsed_micro: i64) {
    match proj {
        Projectile::Rocket(props) => {
            let current_dir = props.spatial.velocity;

            let desired_dir_norm = target_spatial
                .position
                .subtract(&props.spatial.position)
                .normalize();

            if let Some(desired_dir_norm) = desired_dir_norm {
                let mut desired_dir = desired_dir_norm.scalar_mul(current_dir.euclidean_len());
                let max_guidance_angle = PI * 0.25;
                let diff_angle = desired_dir_norm.angle_rad(&current_dir);
                if diff_angle.abs() > max_guidance_angle {
                    desired_dir = current_dir
                        .rotate(-max_guidance_angle * diff_angle.signum())
                        .normalize()
                        .unwrap();
                }
                let diff = desired_dir.subtract(&current_dir);
                let len = diff.euclidean_len();
                let max_shift_len = props.guidance_acceleration * (elapsed_micro as f64);
                let shift_len = if len > max_shift_len {
                    max_shift_len
                } else {
                    len
                };
                if let Some(diff) = diff.normalize() {
                    if shift_len > 1e-9 {
                        let scaled_shift = diff.scalar_mul(shift_len);
                        props.spatial.velocity = props.spatial.velocity.add(&scaled_shift);
                        align_rotation_with_velocity(&mut props.spatial);
                    }
                };
            }
        }
    }
}

pub const DEFAULT_PROJECTILE_SPEED: f64 = 50.0 / 1000.0 / 1000.0;
pub const DEFAULT_PROJECTILE_ACC: f64 = 25.0 / 1e6 / 1e6;
pub const DEFAULT_PROJECTILE_ROT_SPEED: f64 = PI / 4.0 / 1000.0 / 1000.0;
pub const DEFAULT_PROJECTILE_ROT_ACC: f64 = PI / 8.0 / 1e6 / 1e6;

pub fn update_proj_collisions(
    loc: &mut Location,
    _options: &UpdateOptions,
    sp_idx: &SpatialIndex,
    _location_idx: usize,
) -> Vec<(ObjectSpecifier, f64)> {
    let mut damages: Vec<(ObjectIndexSpecifier, f64)> = vec![];
    let mut current_idx = -1;
    loc.projectiles.retain(|proj| {
        current_idx += 1;
        let any_coll = sp_idx
            .rad_search(&proj.get_spatial().position, proj.get_spatial().radius)
            .into_iter()
            .filter(|os| match os {
                // prevent collision detection with itself
                ObjectIndexSpecifier::Projectile { idx } => *idx != (current_idx as usize),
                _ => true,
            })
            .collect::<Vec<ObjectIndexSpecifier>>();
        if any_coll.len() > 0 {
            let mut damaged: Vec<(ObjectIndexSpecifier, f64)> = sp_idx
                .rad_search(&proj.get_spatial().position, proj.get_spatial().radius)
                .into_iter()
                .map(|os| (os, proj.get_damage()))
                .collect();
            // warn!(format!(
            //     "boom {} on {:?}",
            //     proj.get_id(),
            //     damaged.iter().map(|(os, _)| os.clone()).collect::<Vec<_>>()
            // ));
            damages.append(&mut damaged);
            return false;
        }
        return true;
    });
    damages
        .into_iter()
        .filter_map(|(ois, d)| object_index_into_object_id(&ois, loc).map(|os| (os, d)))
        .collect()
}
