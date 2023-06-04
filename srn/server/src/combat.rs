use rand_pcg::Pcg64Mcg;
use serde_derive::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use std::collections::HashSet;
use std::f64::consts::PI;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::abilities::{Ability, SHOOT_COOLDOWN_TICKS};
use crate::autofocus::{
    object_index_into_health_mut, object_index_into_object_id, object_index_into_object_pos,
    SpatialIndex,
};
use crate::indexing::{
    find_my_player_mut, find_my_ship_index, find_my_ship_mut, find_spatial_ref_by_spec,
    GameStateIndexes, ObjectIndexSpecifier, ObjectSpecifier,
};
use crate::planet_movement::project_body_relative_position;
use crate::properties::properties_main::ObjectProperty;
use crate::properties::*;
use crate::random_stuff::generate_normal_random;
use crate::spatial_movement::{align_rotation_with_velocity, Movement};
use crate::system_gen::DEFAULT_WORLD_UPDATE_EVERY_TICKS;
use crate::vec2::Vec2f64;
use crate::world::{
    remove_object, GameState, LocalEffect, Location, Player, ProcessProps, Ship, SpatialProps,
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
    pub acc_periodic_dmg: f64,
    pub acc_periodic_heal: f64,
}

impl Health {
    pub fn new(max: f64) -> Health {
        Health {
            current: max,
            max,
            regen_per_tick: None,
            last_damage_dealer: None,
            acc_periodic_dmg: 0.0,
            acc_periodic_heal: 0.0,
        }
    }

    pub fn new_regen(max: f64, regen_per_tick: f64) -> Health {
        Health {
            current: max,
            max,
            regen_per_tick: Some(regen_per_tick),
            last_damage_dealer: None,
            acc_periodic_dmg: 0.0,
            acc_periodic_heal: 0.0,
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
    let _target_pos = target_pos.unwrap().clone();

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
        loc.short_counter = (loc.short_counter + 1) % i32::MAX;
        instance.set_id(loc.short_counter);
        instance.set_position_from(&shooting_ship.spatial.position);
        instance.set_target(&target);

        let mut new_rot = -shooting_ship.spatial.rotation_rad;
        let deviation = generate_normal_random(0.0, 0.15, prng);
        new_rot -= deviation;
        let new_velocity = Vec2f64 { x: 1.0, y: 0.0 }.rotate(new_rot);
        let new_velocity =
            new_velocity.scalar_mul(proj_template.get_spatial().velocity.euclidean_len() * 0.3);
        // ensure that new projectile is not launched inside the ship, as otherwise it can collide and blow immediately
        instance.get_spatial_mut().position = instance.get_spatial().position.add(
            &new_velocity
                .normalize()
                .expect("new velocity should be non-zero")
                .scalar_mul(shooting_ship.spatial.radius + proj_template.get_spatial().radius),
        );
        instance.get_spatial_mut().velocity = new_velocity;
        // because visual coordinates are inverted, we need negation here while not negating the velocity
        instance.get_spatial_mut().rotation_rad = -new_rot;
        loc.projectiles.push(instance);
    }
}

// (signum_gas, signum_turn)
pub fn guide_projectile(
    proj: &mut Projectile,
    target_spatial: &SpatialProps,
    elapsed_micro: i64,
) -> (f64, f64, f64) {
    let eps = 1e-6;
    return match proj {
        Projectile::Rocket(props) => {
            let mut gas = 0.0;
            let mut turn = 0.0;
            let mut brake = 0.0;
            let dir_to_target = target_spatial.position.subtract(&props.spatial.position);
            let rot_dir_to_target =
                dir_to_target.angle_rad_circular_rotation(&Vec2f64 { x: 1.0, y: 0.0 });
            let vel_angle_dir = props.spatial.velocity.angle_rad_signed(&dir_to_target);
            let mut rot_angle_with_target =
                rot_dir_to_target - props.spatial.rotation_rad % (PI * 2.0);
            if rot_angle_with_target > PI {
                // transform rotation angle into absolute diff angle for 180+ deg
                rot_angle_with_target = -2.0 * PI + rot_angle_with_target
            }
            if rot_angle_with_target.abs() <= PI / 8.0 + eps {
                // if props.spatial.velocity.euclidean_len() < props.movement.get_max_speed() - eps {
                gas = 1.0;
                // }
            } else if rot_angle_with_target.abs() >= PI / 2.0 - 1e6
                // only try to stop if misaligned
                && vel_angle_dir.abs() >= PI / 4.0 - 1e6
                // don't stop, ever
                && props.spatial.velocity.euclidean_len() >= props.movement.get_max_speed() * 0.5
            {
                brake = 1.0;
            }
            if rot_angle_with_target.abs() >= eps {
                let shift_till_next_approx =
                    props.movement.get_angular_speed() * elapsed_micro as f64;
                if rot_angle_with_target > eps - shift_till_next_approx {
                    turn = 1.0;
                } else if rot_angle_with_target < eps - shift_till_next_approx {
                    turn = -1.0;
                }
            }
            // log2!(
            //     " a:{:.2}, at:{:.2}",
            //     rot_dir_to_target,
            //     rot_angle_with_target
            // );
            *proj.get_markers_mut() = markers_to_string(gas, turn, brake);
            // *proj.get_markers_mut() = proj.get_markers_mut().as_mut().map(|v| {
            //     v.clone()
            //         + format!(
            //             " a:{:.2}, at:{:.2}",
            //             rot_dir_to_target, rot_angle_with_target
            //         )
            //         .as_str()
            // });
            (gas, turn, brake)
        }
    };
}

fn markers_to_string(gas: f64, turn: f64, brake: f64) -> Option<String> {
    if gas != 0.0 || turn != 0.0 {
        let mut str: String = "".to_string();
        if gas > 0.0 {
            str += "↑"
        } else if gas < 0.0 {
            str += "↓"
        }
        // visual rotation is inverted
        if turn > 0.0 {
            str += "↷"
        } else if turn < 0.0 {
            str += "↶"
        }
        if brake > 0.0 {
            str += "⨯"
        }
        Some(str)
    } else {
        None
    }
}

pub const DEFAULT_PROJECTILE_SPEED: f64 = 25.0 / 1e6;
pub const DEFAULT_PROJECTILE_ACC: f64 = 75.0 / 1e6 / 1e6;
pub const DEFAULT_PROJECTILE_ROT_SPEED: f64 = PI / 2.0 / 1e6;
pub const DEFAULT_PROJECTILE_ROT_ACC: f64 = PI / 1e6 / 1e6;
pub const DEFAULT_PROJECTILE_EXPIRATION_TICKS: i32 = 15 * 1000 * 1000;

pub fn update_proj_collisions(
    loc: &mut Location,
    _options: &UpdateOptions,
    sp_idx: &SpatialIndex,
    _location_idx: usize,
) -> Vec<(ObjectSpecifier, f64)> {
    let mut damages: Vec<(ObjectIndexSpecifier, f64)> = vec![];
    let mut current_idx = -1;
    let mut explosions = vec![];
    for proj in loc.projectiles.iter_mut() {
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
                .map(|os| (os, proj.get_direct_damage()))
                .collect();
            warn2!(
                "boom proj {} on {:?}",
                proj.get_id(),
                damaged.iter().map(|(os, _)| os.clone()).collect::<Vec<_>>()
            );
            if let Some(exp) = proj.get_explosion_props() {
                explosions.push((exp.clone(), proj.get_spatial().position.clone()))
            }
            // damages.append(&mut damaged);
            *proj.get_to_clean_mut() = true;
        }
    }
    for (exp, pos) in explosions.into_iter() {
        create_explosion(&exp, &pos, loc);
    }
    damages
        .into_iter()
        .filter_map(|(ois, d)| object_index_into_object_id(&ois, loc).map(|os| (os, d)))
        .collect()
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag", content = "fields")]
pub enum Projectile {
    Rocket(RocketProps),
}

impl Projectile {
    pub fn get_explosion_props(&self) -> Option<&ExplosionProps> {
        match self {
            Projectile::Rocket(rocketProps) => Some(&rocketProps.explosion_props),
        }
    }
    pub fn get_to_clean_mut(&mut self) -> &mut bool {
        match self {
            Projectile::Rocket(props) => &mut props.to_clean,
        }
    }

    pub fn get_to_clean(&self) -> &bool {
        match self {
            Projectile::Rocket(props) => &props.to_clean,
        }
    }
    pub fn get_markers_mut(&mut self) -> &mut Option<String> {
        match self {
            Projectile::Rocket(props) => &mut props.markers,
        }
    }

    pub fn get_properties(&self) -> &Vec<ObjectProperty> {
        match self {
            Projectile::Rocket(props) => &props.properties,
        }
    }

    pub fn get_properties_mut(&mut self) -> &mut Vec<ObjectProperty> {
        match self {
            Projectile::Rocket(props) => &mut props.properties,
        }
    }

    pub fn get_target(&self) -> Option<ObjectSpecifier> {
        match self {
            Projectile::Rocket(props) => props.target.clone(),
        }
    }

    pub fn get_movement(&self) -> &Movement {
        match self {
            Projectile::Rocket(props) => &props.movement,
        }
    }

    pub fn get_spatial(&self) -> &SpatialProps {
        match self {
            Projectile::Rocket(props) => &props.spatial,
        }
    }

    pub fn get_direct_damage(&self) -> f64 {
        match self {
            Projectile::Rocket(_) => 0.0,
        }
    }

    pub fn get_spatial_mut(&mut self) -> &mut SpatialProps {
        match self {
            Projectile::Rocket(props) => &mut props.spatial,
        }
    }

    pub fn set_target(&mut self, t: &ShootTarget) {
        match self {
            Projectile::Rocket(props) => props.target = t.to_specifier(),
        }
    }
    pub fn set_position_from(&mut self, from: &Vec2f64) {
        match self {
            Projectile::Rocket(props) => {
                props.spatial.position = from.clone();
            }
        }
    }
}

impl Projectile {
    pub fn get_id(&self) -> i32 {
        match self {
            Projectile::Rocket(RocketProps { id, .. }) => *id,
        }
    }

    pub fn set_id(&mut self, val: i32) {
        match self {
            Projectile::Rocket(RocketProps { id, .. }) => *id = val,
        };
    }
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct RocketProps {
    pub id: i32,
    pub spatial: SpatialProps,
    pub movement: Movement,
    pub properties: Vec<ObjectProperty>,
    pub target: Option<ObjectSpecifier>,
    pub explosion_props: ExplosionProps,
    pub markers: Option<String>,
    pub to_clean: bool,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Explosion {
    pub id: i32,
    pub spatial: SpatialProps,
    pub base: ExplosionProps,
    pub decay_expand: ProcessProps,
    pub damaged: HashSet<ObjectSpecifier>,
    pub to_clean: bool,
}

pub fn gen_turrets(count: usize, _prng: &mut Pcg64Mcg) -> Vec<(Ability, ShipTurret)> {
    let mut res = vec![];
    for i in 0..count {
        let id = i.to_string();
        res.push((
            Ability::Shoot {
                cooldown_ticks_remaining: 0,
                turret_id: id.clone(), // only needs to be locally-unique
                cooldown_normalized: 0.0,
                cooldown_ticks_max: SHOOT_COOLDOWN_TICKS,
            },
            ShipTurret { id },
        ));
    }
    let id = res.len().to_string();
    res.push((
        Ability::Launch {
            cooldown_ticks_remaining: 0,
            turret_id: id.clone(),
            projectile_template_id: TemplateId::Rocket as i32,
            cooldown_normalized: 0.0,
            cooldown_ticks_max: SHOOT_COOLDOWN_TICKS,
        },
        ShipTurret { id },
    ));
    res
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ShipTurret {
    pub id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ExplosionProps {
    pub damage: f64,
    pub radius: f64,
    pub applied_force: f64, // since for now my objects don't have mass, let's assume that force = acceleration
    pub spread_speed: f64,
}

pub fn create_explosion(props: &ExplosionProps, at: &Vec2f64, loc: &mut Location) {
    loc.short_counter += 1;
    let exp = Explosion {
        id: loc.short_counter,
        spatial: SpatialProps {
            position: at.clone(),
            velocity: Default::default(),
            angular_velocity: 0.0,
            rotation_rad: 0.0,
            radius: 0.0,
        },
        base: props.clone(),
        decay_expand: ProcessProps {
            progress_normalized: 0.0,
            remaining_ticks: (props.radius / props.spread_speed) as i32,
            max_ticks: (props.radius / props.spread_speed) as i32,
        },
        damaged: HashSet::new(),
        to_clean: false,
    };
    loc.explosions.push(exp);
}

pub const MIN_COLLIDER_RADIUS: f64 = 1.0;
pub const MAX_COLLIDER_RADIUS: f64 = 1.0;

pub fn update_explosions(loc: &mut Location, elapsed_ticks: i32, spatial_index: &SpatialIndex) {
    for exp in loc.explosions.iter_mut() {
        if exp.decay_expand.apply(elapsed_ticks) {
            exp.to_clean = true;
        }
        exp.spatial.radius = exp.base.radius * exp.decay_expand.progress_normalized;
    }
    for i in 0..loc.explosions.len() {
        let exp = &loc.explosions[i];
        let all_affected = spatial_index.rad_search_consider_obj_radius(
            &exp.spatial.position,
            exp.spatial.radius,
            loc,
        );
        log2!("all_affected: {:?}", all_affected);
        log2!("already damaged {:?}", exp.damaged);
        let shockwave_damaged = all_affected
            .into_iter()
            .filter_map(|ois| {
                object_index_into_object_id(&ois, loc).map_or(None, |oid| {
                    if !exp.damaged.contains(&oid) {
                        Some((ois.clone(), oid.clone()))
                    } else {
                        None
                    }
                })
            })
            .collect::<Vec<_>>();
        // apply shockwave but only once
        let mut exp = &mut loc.explosions[i];
        for (ois, oid) in shockwave_damaged.iter() {
            exp.damaged.insert(oid.clone());
        }
        let exp = &loc.explosions[i];
        damage_objects(
            loc,
            shockwave_damaged.iter().map(|p| p.0).collect(),
            exp.base.damage,
        );

        // apply constant push
        push_objects(
            loc,
            all_affected,
            elapsed_ticks,
            exp.base.applied_force,
            &exp.spatial.position,
        );
    }
}

pub fn push_objects(
    loc: &mut Location,
    targets: Vec<ObjectIndexSpecifier>,
    elapsed_ticks: i32,
    force: f64,
    from: &Vec2f64,
) {
    for ois in targets {
        if let Some(pos) = object_index_into_object_pos(&ois, loc) {
            if let Some(dir) = pos.subtract(from).normalize() {
                let mass = 1.0;
                let velocity = dir.scalar_mul(force * elapsed_ticks as f64 / mass);
                match ois {
                    ObjectIndexSpecifier::Unknown => {}
                    ObjectIndexSpecifier::Mineral { idx } => {
                        loc.minerals.get_mut(idx).map(|m| {
                            m.x += velocity.x * elapsed_ticks as f64;
                            m.y += velocity.y * elapsed_ticks as f64;
                        });
                    }
                    ObjectIndexSpecifier::Wreck { idx } => {
                        loc.wrecks.get_mut(idx).map(|w| {
                            w.spatial.velocity = w.spatial.velocity.add(&velocity);
                        });
                    }
                    ObjectIndexSpecifier::Container { idx } => {
                        loc.containers.get_mut(idx).map(|c| {
                            c.position = c.position.add(&velocity.scalar_mul(elapsed_ticks as f64));
                        });
                    }
                    ObjectIndexSpecifier::Projectile { idx } => {
                        loc.projectiles.get_mut(idx).map(|p| {
                            p.get_spatial_mut().velocity =
                                p.get_spatial_mut().velocity.add(&velocity)
                        });
                    }
                    ObjectIndexSpecifier::Asteroid { idx } => {
                        loc.asteroids
                            .get_mut(idx)
                            .map(|a| a.spatial.velocity = a.spatial.velocity.add(&velocity));
                    }
                    ObjectIndexSpecifier::Planet { .. } => {
                        // planets cannot be pushed
                    }
                    ObjectIndexSpecifier::Ship { idx } => {
                        loc.ships
                            .get_mut(idx)
                            .map(|s| s.spatial.velocity = s.spatial.velocity.add(&velocity));
                    }
                    ObjectIndexSpecifier::Star => {
                        // stars cannot be pushed
                    }
                }
            }
        }
    }
}

pub fn damage_objects(loc: &mut Location, targets: Vec<ObjectIndexSpecifier>, amount: f64) {
    for ois in targets {
        log2!("damage {:?}", ois);
        if let Some(health) = object_index_into_health_mut(&ois, loc) {
            health.current -= amount;
        }
    }
}
