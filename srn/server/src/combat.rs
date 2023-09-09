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
    extract_closest_into, object_index_into_object_id, object_index_into_object_pos, SpatialIndex,
};
use crate::effects::{add_effect, LocalEffect, LocalEffectCreate};
use crate::fof::{FofActor, FofOverrides};
use crate::hp::{object_index_into_health_mut, object_index_into_to_clean_mut};
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
    remove_object, GameState, Location, Player, ProcessProps, Ship, SpatialProps, TemplateId,
    UpdateOptions,
};
use crate::{indexing, new_id, world};

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
    target: ObjectSpecifier,
    loc: &Location,
    ship: &Ship,
    active_turret_id: i32,
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
        ObjectSpecifier::Unknown => {}
        ObjectSpecifier::Ship { .. } => {}
        ObjectSpecifier::Mineral { id } => {
            if let Some(min) = indexing::find_mineral(loc, id) {
                let min_pos = Vec2f64 { x: min.x, y: min.y };
                if !check_distance(ship, shoot_ability, min_pos) {
                    return false;
                }
            } else {
                return false;
            }
        }
        ObjectSpecifier::Container { id } => {
            if let Some(cont) = indexing::find_container(loc, id) {
                if !check_distance(ship, shoot_ability, cont.position) {
                    return false;
                }
            } else {
                return false;
            }
        }
        ObjectSpecifier::Asteroid { id } => {
            if let Some(ast) = indexing::find_asteroid(loc, id) {
                if !check_distance(ship, shoot_ability, ast.spatial.position) {
                    return false;
                }
            } else {
                return false;
            }
        }
        _ => return false,
    };
    return true;
}

pub fn validate_launch(_loc: &Location, ship: &Ship, active_turret_id: i32) -> bool {
    let shoot_ability = find_turret_ability(ship, active_turret_id);
    if shoot_ability.is_none() {
        return false;
    }
    let shoot_ability = shoot_ability.unwrap();

    if shoot_ability.get_current_cooldown() > 0 {
        return false;
    }
    return true;
}

pub fn find_turret_ability(ship: &Ship, active_turret_id: i32) -> Option<&Ability> {
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
    target: ObjectSpecifier,
    active_turret_id: i32,
    indexes: &GameStateIndexes,
) {
    if let Some(ship_loc) = find_my_ship_index(state, player_shooting) {
        let loc = &state.locations[ship_loc.location_idx];
        let shooting_ship_read = &loc.ships[ship_loc.ship_idx].clone();
        let shooting_ship_id = shooting_ship_read.id;
        let shoot_ability = find_turret_ability(shooting_ship_read, active_turret_id);
        if shoot_ability.is_none() {
            return;
        }
        let shoot_ability = shoot_ability.unwrap().clone();

        match target {
            ObjectSpecifier::Unknown => {}
            ObjectSpecifier::Ship { id: target_ship_id } => {
                let dmg = SHIP_SHOOT_STRENGTH;
                let target_ship = state.locations[ship_loc.location_idx]
                    .ships
                    .iter_mut()
                    .find(|s| s.id == target_ship_id);
                let damaged = if let Some(target_ship) = target_ship {
                    target_ship.health.current -= dmg;
                    target_ship.health.last_damage_dealer = Some(ObjectSpecifier::Ship {
                        id: shooting_ship_id,
                    });
                    true
                } else {
                    false
                };
                if damaged {
                    add_effect(
                        LocalEffectCreate::DmgDone { hp: dmg as i32 },
                        ObjectSpecifier::Ship {
                            id: shooting_ship_id,
                        },
                        Some(active_turret_id),
                        ObjectSpecifier::Ship { id: target_ship_id },
                        &mut state.locations[ship_loc.location_idx],
                        indexes,
                        state.ticks,
                    )
                }
            }
            ObjectSpecifier::Mineral { id } => {
                if let Some(min) = indexing::find_mineral(loc, id) {
                    let min_pos = Vec2f64 { x: min.x, y: min.y };
                    if !check_distance(shooting_ship_read, &shoot_ability, min_pos) {
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
            ObjectSpecifier::Container { id } => {
                if let Some(cont) = indexing::find_container(loc, id) {
                    if !check_distance(shooting_ship_read, &shoot_ability, cont.position) {
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
            ObjectSpecifier::Asteroid { id } => {
                if let Some(ast) = indexing::find_asteroid(loc, id) {
                    if !check_distance(shooting_ship_read, &shoot_ability, ast.spatial.position) {
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
            _ => {}
        }
    }
}

pub fn resolve_launch(
    state: &mut GameState,
    player_shooting: Uuid,
    active_turret_id: i32,
    _client: bool,
    prng: &mut Pcg64Mcg,
) {
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

        match &mut instance {
            Projectile::Rocket(rocket) => {
                rocket.fof_overrides = shooting_ship.fof_overrides.clone();
            }
        }

        let mut new_rot = -shooting_ship.spatial.rotation_rad;
        let deviation = generate_normal_random(0.0, 0.15, prng);
        new_rot -= deviation;
        let new_velocity = Vec2f64 { x: 1.0, y: 0.0 }.rotate(new_rot);
        let new_velocity = shooting_ship.spatial.velocity.add(
            &new_velocity.scalar_mul(proj_template.get_spatial().velocity.euclidean_len() * 0.3),
        );
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

pub fn guide_projectile(
    proj: &Projectile,
    target_spatial: &SpatialProps,
    elapsed_micro: i64,
) -> (f64, f64, f64) {
    let eps = 1e-6;
    let (gas, turn, brake) = match proj {
        Projectile::Rocket(props) => {
            let current_spatial = &props.spatial;
            let current_movement = &props.movement;

            guide_accelerated_object(
                &SpatialProps {
                    position: target_spatial.position,
                    // maximize velocity for impact in attempt to minimize time
                    velocity: proj
                        .get_spatial()
                        .velocity
                        .normalize()
                        .map_or(Vec2f64::zero(), |v| {
                            v.scalar_mul(proj.get_movement().get_max_speed())
                        }),
                    angular_velocity: 0.0,
                    // attempt to not change the current rotation
                    rotation_rad: proj.get_spatial().rotation_rad,
                    radius: target_spatial.radius,
                },
                elapsed_micro,
                eps,
                &current_spatial,
                current_movement,
            )
        }
    };
    return (gas, turn, brake);
}

pub fn guide_accelerated_object(
    target_spatial: &SpatialProps,
    elapsed_micro: i64,
    eps: f64,
    current_spatial: &SpatialProps,
    current_movement: &Movement,
) -> (f64, f64, f64) {
    let mut gas = 0.0;
    let mut turn = 0.0;
    let mut brake = 0.0;
    let dir_to_target = target_spatial.position.subtract(&current_spatial.position);

    // 'ideal' angle that our velocity should align to, 0..2PI
    let rot_of_dir_to_target =
        dir_to_target.angle_rad_circular_rotation(&Vec2f64 { x: 1.0, y: 0.0 });
    // 'mistake' value of velocity, -PI..PI
    let vel_angle_dir = current_spatial.velocity.angle_rad_signed(&dir_to_target);
    // 'mistake' value of current rotation, 0..2PI
    let mut rot_angle_with_target =
        rot_of_dir_to_target - current_spatial.rotation_rad % (PI * 2.0);
    if rot_angle_with_target > PI {
        // transform rotation angle into absolute diff angle for 180+ deg
        rot_angle_with_target = -2.0 * PI + rot_angle_with_target
    }
    // at this point, rot_of_dir_to_target is -PI..PI
    // now, assume that if the direction of rotation is kindof correct, we are free to accelerate,
    // or, if it's very incorrect, brake
    if rot_angle_with_target.abs() <= PI / 8.0 + eps {
        // normally, accelerate fully till the end (impact approach)
        gas = 1.0;
        // somewhat special case when we want to stop, e.g. for ship movement instead of projectiles
        let current_speed_len = current_spatial.velocity.euclidean_len();
        let target_speed_len = target_spatial.velocity.euclidean_len();
        let speed_diff = current_speed_len - target_speed_len;
        if speed_diff > eps {
            // this is an approximation ignoring current velocity direction, but it's a good one to decide if
            // we should brake or not
            let time_to_compensate =
                speed_diff / current_movement.get_current_linear_acceleration();
            let t = time_to_compensate;
            let a = current_movement.get_current_linear_acceleration();
            let brake_distance = t * t * a + target_speed_len * t;
            if dir_to_target.euclidean_len() < brake_distance {
                // time to slow down
                brake = 1.0;
            } else {
                gas = 1.0;
            }
        }
    } else if rot_angle_with_target.abs() >= PI / 2.0 - eps
        // only try to stop if misaligned
        && vel_angle_dir.abs() >= PI / 4.0 - eps
        // don't stop, ever
        && current_spatial.velocity.euclidean_len() >= current_movement.get_max_speed() * 0.5
    {
        brake = 1.0;
    }

    // now, correct the angle considering both angle of the velocity and current rotation
    if rot_angle_with_target.abs() + vel_angle_dir.abs() >= eps {
        let shift_till_next_approx = current_movement.get_angular_speed() * elapsed_micro as f64;
        // dumb cases, full turn
        if rot_angle_with_target > 0.0 && rot_angle_with_target > shift_till_next_approx {
            turn = 1.0;
        } else if rot_angle_with_target < 0.0 && rot_angle_with_target < shift_till_next_approx {
            turn = -1.0;
        } else {
            // complicated case where we need -1 < x < 1, but not 1, because otherwise we overshoot
            turn = ((rot_angle_with_target - shift_till_next_approx)
                / (elapsed_micro * elapsed_micro) as f64)
                .min(1.0)
                .max(-1.0);
        }
    }
    // log2!(
    //     " a:{:.2}, at:{:.2}",
    //     rot_dir_to_target,
    //     rot_angle_with_target
    // );
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

pub fn markers_to_string(gas: f64, turn: f64, brake: f64) -> Option<String> {
    if gas != 0.0 || turn != 0.0 {
        let mut str: String = "".to_string();
        if gas > 0.0 {
            str += "↑"
        } else if gas < 0.0 {
            str += "↓"
        }
        // visual rotation is inverted compared to math rotation which is used
        if turn > 0.0 {
            str += "↶";
            // str += format!("↶{:.2}", turn).as_str();
        } else if turn < 0.0 {
            str += "↷";
            // str += format!("↷{:.2}", turn).as_str();
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
pub const DEFAULT_PROJECTILE_ROT_SPEED: f64 = PI * 2.0 / 1.0 / 1e6;
pub const DEFAULT_PROJECTILE_ROT_ACC: f64 = PI / 1e6 / 1e6;
pub const DEFAULT_PROJECTILE_EXPIRATION_TICKS: i32 = 15 * 1000 * 1000;

pub fn update_projectile_collisions(
    loc: &mut Location,
    _options: &UpdateOptions,
    sp_idx: &SpatialIndex,
    _loc_idx: usize,
    indexes: &mut GameStateIndexes,
    current_tick: u64,
) -> Vec<(ObjectSpecifier, f64)> {
    let damages: Vec<(ObjectIndexSpecifier, f64)> = vec![];
    let mut current_idx = -1;
    let mut exploded_ids = vec![];
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
            // let mut damaged: Vec<(ObjectIndexSpecifier, f64)> = sp_idx
            //     .rad_search(&proj.get_spatial().position, proj.get_spatial().radius)
            //     .into_iter()
            //     .filter(|os| match os {
            //         // prevent collision detection with itself
            //         ObjectIndexSpecifier::Projectile { idx } => *idx != (current_idx as usize),
            //         _ => true,
            //     })
            //     .map(|os| (os, proj.get_direct_damage()))
            //     .collect();
            // warn2!(
            //     "boom proj {} on {:?}",
            //     proj.get_id(),
            //     any_coll.iter().map(|os| os.clone()).collect::<Vec<_>>()
            // );
            // if let Some(exp) = proj.get_explosion_props() {
            //     explosions.push((
            //         exp.clone(),
            //         proj.get_spatial().position.clone(),
            //         Some(proj.get_id()),
            //     ))
            // }
            // damages.append(&mut damaged);
            exploded_ids.push(ObjectSpecifier::Projectile { id: proj.get_id() });
        }
    }
    for exp_id in exploded_ids.into_iter() {
        let source = &exp_id.clone();
        damage_objects(loc, &vec![exp_id], INSTAKILL, source, indexes, current_tick);
    }
    // kind of 'kinetic' part of the damage, not the explosion
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
    pub fn get_health_mut(&mut self) -> Option<&mut Health> {
        match self {
            Projectile::Rocket(props) => Some(&mut props.health),
        }
    }
    pub fn get_explosion_props(&self) -> Option<&ExplosionProps> {
        match self {
            Projectile::Rocket(rocket_props) => Some(&rocket_props.explosion_props),
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

    pub fn set_target(&mut self, t: &ObjectSpecifier) {
        match self {
            Projectile::Rocket(props) => props.target = Some(t.clone()),
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
    pub health: Health,
    pub to_clean: bool,
    pub fof_overrides: Option<FofOverrides>,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Explosion {
    pub id: i32,
    pub spatial: SpatialProps,
    pub base: ExplosionProps,
    pub parent_projectile_id: Option<i32>,
    pub decay_expand: ProcessProps,
    pub damaged: HashSet<ObjectSpecifier>,
    pub to_clean: bool,
}

pub fn gen_turrets(count: usize, _prng: &mut Pcg64Mcg) -> Vec<(Ability, ShipTurret)> {
    let mut res = vec![];
    for i in 0..count {
        let id = i as i32;
        res.push((
            Ability::Shoot {
                cooldown_ticks_remaining: 0,
                turret_id: id,
                cooldown_normalized: 0.0,
                cooldown_ticks_max: SHOOT_COOLDOWN_TICKS,
            },
            ShipTurret { id },
        ));
    }
    let id = res.len() as i32;
    res.push((
        Ability::Launch {
            cooldown_ticks_remaining: 0,
            turret_id: id,
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
    pub id: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ExplosionProps {
    pub damage: f64,
    pub radius: f64,
    pub applied_force: f64, // since for now my objects don't have mass, let's assume that force = acceleration
    pub spread_speed: f64,
}

pub fn create_explosion(
    props: &ExplosionProps,
    at: &Vec2f64,
    loc: &mut Location,
    from_projectile_id: Option<i32>,
    indexes: &mut GameStateIndexes,
    loc_idx: usize,
) {
    loc.short_counter += 1;
    let time_to_expand = props.radius / props.spread_speed;
    let exp = Explosion {
        id: loc.short_counter,
        spatial: SpatialProps {
            position: at.clone(),
            velocity: Default::default(),
            angular_velocity: 0.0,
            rotation_rad: 0.0,
            radius: props.radius,
        },
        base: props.clone(),
        parent_projectile_id: from_projectile_id,
        decay_expand: ProcessProps {
            progress_normalized: 0.0,
            remaining_ticks: time_to_expand as i32,
            max_ticks: time_to_expand as i32,
        },
        damaged: HashSet::new(),
        to_clean: false,
    };
    loc.explosions.push(exp);
    indexes.handle_explosion_added(loc_idx, loc);
}

pub const MIN_COLLIDER_RADIUS: f64 = 1.0;
pub const MAX_COLLIDER_RADIUS: f64 = 1.0;

// Hyperbolic growth https://www.math3d.org/SiBxZxAdk
// should be synced with explosion visual formula from the shader in ThreeExplosionNodeV2.tsx
pub fn calculate_radius(progress_normalized: f64, explosion_radius: f64) -> f64 {
    let from = 0.05;
    let to = explosion_radius;
    let x = progress_normalized;
    let x = (3.0 - (0.5 / (x + 0.15))) / 3.0;
    return from + (to - from) * x;
}

pub fn update_explosions(
    loc: &mut Location,
    elapsed_ticks: i32,
    spatial_index: &SpatialIndex,
    indexes: &GameStateIndexes,
    current_tick: u64,
) {
    for exp in loc.explosions.iter_mut() {
        if exp.decay_expand.apply(elapsed_ticks) {
            exp.to_clean = true;
        }
        exp.spatial.radius =
            calculate_radius(exp.decay_expand.progress_normalized, exp.base.radius);
    }
    for i in 0..loc.explosions.len() {
        let exp_r = &loc.explosions[i].clone();
        let all_affected = spatial_index.rad_search_consider_obj_radius(
            &exp_r.spatial.position,
            exp_r.spatial.radius,
            loc,
        );
        let shockwave_damaged = all_affected
            .iter()
            .filter_map(|ois| {
                object_index_into_object_id(&ois, loc).map_or(None, |oid| {
                    if !exp_r.damaged.contains(&oid) {
                        if (*ois != ObjectIndexSpecifier::Explosion { idx: i })
                            // special trick to prevent explosion created from projectile from damaging the same projectile
                            // while it's ok technically it doesn't make much sense to do
                            && exp_r.parent_projectile_id.map_or(true, |ppid| (oid != ObjectSpecifier::Projectile { id: ppid}))  {
                            Some((ois.clone(), oid.clone()))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
            })
            .collect::<Vec<_>>();
        {
            // apply shockwave but only once
            let exp = &mut loc.explosions[i];
            for (_ois, oid) in shockwave_damaged.iter() {
                exp.damaged.insert(oid.clone());
            }
        }
        damage_objects(
            loc,
            &shockwave_damaged.iter().map(|i| i.1.clone()).collect(),
            exp_r.base.damage,
            &ObjectSpecifier::Explosion { id: exp_r.id },
            indexes,
            current_tick,
        );

        // apply constant push
        push_objects(
            loc,
            all_affected,
            elapsed_ticks,
            exp_r.base.applied_force,
            &exp_r.spatial.position,
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
                    ObjectIndexSpecifier::Explosion { .. } => {
                        // projectiles cannot be pushed
                    }
                    ObjectIndexSpecifier::AsteroidBelt { .. } => {
                        // asteroid belts cannot be pushed
                    }
                }
            }
        }
    }
}

// special constant to 'unconditionally' kill objects without an effect, e.g. for rocket's sake,
// while still using common damage_objects
pub const INSTAKILL: f64 = 10e6;

pub fn damage_objects(
    loc: &mut Location,
    targets: &Vec<ObjectSpecifier>,
    amount: f64,
    source: &ObjectSpecifier,
    indexes: &GameStateIndexes,
    current_tick: u64,
) {
    for os in targets {
        let damage = if let (Some(health), Some(ois)) = indexes
            .reverse_id_index
            .get(os)
            .map_or((None, None), |ois| {
                (object_index_into_health_mut(ois, loc), Some(ois))
            }) {
            health.current -= amount;
            health.current = health.current.max(0.0);
            health.last_damage_dealer = Some(os.clone());
            if health.current == 0.0 {
                if let Some(to_clean) = object_index_into_to_clean_mut(ois, loc) {
                    *to_clean = true;
                };
            }
            amount
        } else {
            0.0
        };
        if damage > 0.0 && damage < INSTAKILL {
            add_effect(
                LocalEffectCreate::DmgDone { hp: damage as i32 },
                source.clone(),
                None,
                os.clone(),
                loc,
                indexes,
                current_tick,
            )
        }
    }
}

pub fn heal_objects(
    loc: &mut Location,
    targets: &Vec<ObjectSpecifier>,
    amount: f64,
    source: &ObjectSpecifier,
    indexes: &GameStateIndexes,
    current_tick: u64,
) {
    for os in targets {
        // log2!("damage {:?} from {:?}", ois.1, _source);
        let heal = if let Some(health) = indexes
            .reverse_id_index
            .get(os)
            .and_then(|ois| object_index_into_health_mut(ois, loc))
        {
            health.current += amount;
            health.current = health.current.min(health.max);
            health.last_damage_dealer = None;
            amount
        } else {
            0.0
        };
        if heal > 0.0 {
            add_effect(
                LocalEffectCreate::Heal { hp: heal as i32 },
                source.clone(),
                Some(current_tick as i32), // extra deduplication to avoid duplicate keys for repeating heal events
                os.clone(),
                loc,
                indexes,
                current_tick,
            )
        }
    }
}

pub const REACQUIRE_RADIUS: f64 = 150.0;
pub fn try_reacquire_target(
    proj_idx_spec: ObjectIndexSpecifier,
    proj_pos: &Vec2f64,
    index: &SpatialIndex,
    state: &GameState,
    loc_idx: usize,
) -> Option<ObjectIndexSpecifier> {
    let mut around_neutral = vec![];
    let mut around_hostile = vec![];

    extract_closest_into(
        &state,
        index,
        loc_idx,
        FofActor::ObjectIdx {
            spec: proj_idx_spec,
        },
        proj_pos,
        &mut around_neutral,
        &mut around_hostile,
        REACQUIRE_RADIUS,
    );
    return around_hostile.first().map(|v| (*v).clone());
}
