use std::any::Any;
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;

use itertools::{chain, Itertools};
use objekt_clonable::*;
use uuid::Uuid;

use crate::combat::Health;
use crate::indexing::{
    index_planets_by_id, GameStateCaches, GameStateIndexes, ObjectSpecifier, Spec,
};
use crate::interpolation::{
    get_orbit_phase_table, get_rotation_phase_table, restore_absolute_positions,
};
use crate::perf::Sampler;
use crate::perf::SamplerMarks;
use crate::vec2::{AsVec2f64, Precision, Vec2f64};
use crate::world::{
    Asteroid, AsteroidBelt, Location, Movement, ObjectProperty, PlanetV2, RotationMovement,
    SpatialProps, Star, AABB,
};
use crate::DEBUG_PHYSICS;
use crate::{vec2, world};

#[clonable]
pub trait IBodyV2: Clone + Anchored + Spec {
    fn get_id(&self) -> Uuid;
    fn get_name(&self) -> &String;
    fn get_spatial(&self) -> &SpatialProps;
    fn get_spatial_mut(&mut self) -> &mut SpatialProps;
    fn get_movement(&self) -> &Movement;
    fn get_rotation_movement(&self) -> &RotationMovement;
    fn get_rotation_movement_mut(&mut self) -> &mut RotationMovement;
    fn get_movement_mut(&mut self) -> &mut Movement;
    fn set_spatial(&mut self, x: SpatialProps);
    fn get_anchor_tier(&self) -> u32;
    fn as_any(&self) -> &dyn Any;
}

impl IBodyV2 for PlanetV2 {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_name(&self) -> &String {
        &self.name
    }

    fn get_spatial(&self) -> &SpatialProps {
        &self.spatial
    }

    fn get_spatial_mut(&mut self) -> &mut SpatialProps {
        &mut self.spatial
    }

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn get_rotation_movement(&self) -> &RotationMovement {
        &self.rot_movement
    }

    fn get_rotation_movement_mut(&mut self) -> &mut RotationMovement {
        &mut self.rot_movement
    }

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps) {
        self.spatial = props;
    }

    fn get_anchor_tier(&self) -> u32 {
        self.anchor_tier
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl Anchored for AsteroidBelt {
    fn get_anchor_dist(&self, indexes: &GameStateIndexes) -> f64 {
        generic_get_anchor_dist(self, indexes)
    }
}

impl Spec for AsteroidBelt {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::AsteroidBelt { id: self.id }
    }
}

impl IBodyV2 for AsteroidBelt {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_name(&self) -> &String {
        unimplemented!()
    }

    fn get_spatial(&self) -> &SpatialProps {
        &self.spatial
    }

    fn get_spatial_mut(&mut self) -> &mut SpatialProps {
        &mut self.spatial
    }

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn get_rotation_movement(&self) -> &RotationMovement {
        &self.rot_movement
    }

    fn get_rotation_movement_mut(&mut self) -> &mut RotationMovement {
        &mut self.rot_movement
    }

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, x: SpatialProps) {
        self.spatial = x;
    }

    fn get_anchor_tier(&self) -> u32 {
        todo!()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl Anchored for Star {
    fn get_anchor_dist(&self, _indexes: &GameStateIndexes) -> f64 {
        0.0
    }
}

impl Spec for Star {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::Star { id: self.id }
    }
}

impl IBodyV2 for Star {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_name(&self) -> &String {
        &self.name
    }

    fn get_spatial(&self) -> &SpatialProps {
        &self.spatial
    }

    fn get_spatial_mut(&mut self) -> &mut SpatialProps {
        &mut self.spatial
    }

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn get_rotation_movement(&self) -> &RotationMovement {
        &self.rot_movement
    }

    fn get_rotation_movement_mut(&mut self) -> &mut RotationMovement {
        &mut self.rot_movement
    }

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps) {
        self.spatial = props;
    }

    fn get_anchor_tier(&self) -> u32 {
        0
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl Spec for Asteroid {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::Asteroid { id: self.id }
    }
}

pub fn generic_get_anchor_dist<T: Spec>(arg: &T, indexes: &GameStateIndexes) -> f64 {
    let specifier = arg.spec();
    *indexes
        .anchor_distances
        .get(&specifier)
        .expect(format!("No anchor distance found for {:?}", specifier).as_str())
}

impl Anchored for Asteroid {
    fn get_anchor_dist(&self, indexes: &GameStateIndexes) -> f64 {
        generic_get_anchor_dist(self, indexes)
    }
}

impl IBodyV2 for Asteroid {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_name(&self) -> &String {
        unimplemented!()
    }

    fn get_spatial(&self) -> &SpatialProps {
        &self.spatial
    }

    fn get_spatial_mut(&mut self) -> &mut SpatialProps {
        &mut self.spatial
    }

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn get_rotation_movement(&self) -> &RotationMovement {
        &self.rot_movement
    }

    fn get_rotation_movement_mut(&mut self) -> &mut RotationMovement {
        &mut self.rot_movement
    }

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, x: SpatialProps) {
        self.spatial = x;
    }

    fn get_anchor_tier(&self) -> u32 {
        1
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl From<Box<dyn IBodyV2>> for Asteroid {
    fn from(val: Box<dyn IBodyV2>) -> Self {
        let spatial = val.get_spatial();
        let movement = val.get_movement();
        Asteroid {
            id: val.get_id(),
            spatial: spatial.clone(),
            movement: movement.clone(),
            rot_movement: RotationMovement::None,
        }
    }
}

fn planets_to_bodies(planets: &Vec<PlanetV2>) -> Vec<Box<dyn IBodyV2>> {
    let mut res: Vec<Box<dyn IBodyV2>> = vec![];
    for planet in planets {
        res.push(Box::new(planet.clone()));
    }
    res
}

fn update_radial_movement(
    current_ticks: u64,
    sampler: &mut Sampler,
    limit_area: AABB,
    indexes: &GameStateIndexes,
    caches: &mut GameStateCaches,
    bodies: Vec<Box<&mut dyn IBodyV2>>,
) {
    for body in bodies {
        let mark = sampler.start(SamplerMarks::UpdateRadialMovement as u32);
        if limit_area.contains_vec(&body.get_spatial().position) {
            project_body_relative_position(current_ticks, indexes, caches, body);
        }
        sampler.end(mark);
    }
}

pub fn project_body_relative_position(
    current_ticks: u64,
    indexes: &GameStateIndexes,
    caches: &mut GameStateCaches,
    mut body: Box<&mut dyn IBodyV2>,
) {
    let anchor_dist = body.get_anchor_dist(indexes);
    let specifier = body.spec();
    let movement_mut = body.get_movement_mut();

    project_movement_relative_position(current_ticks, caches, anchor_dist, movement_mut, specifier)
}

pub fn project_movement_relative_position(
    current_ticks: u64,
    caches: &mut GameStateCaches,
    anchor_dist: f64,
    movement_mut: &mut Movement,
    specifier: ObjectSpecifier,
) {
    let phase_table = get_orbit_phase_table(&mut caches.rel_orbit_cache, movement_mut, anchor_dist);
    match movement_mut {
        Movement::RadialMonotonous {
            relative_position,
            phase,
            full_period_ticks,
            start_phase,
            ..
        } => {
            if (*full_period_ticks).abs() < 1e-3 || phase_table.len() == 0 {
                panic!("bad movement for {:?}: {:?}", specifier, movement_mut);
            }
            let phase_abs = ((current_ticks as i64 % (*full_period_ticks) as i64) as f64
                / (*full_period_ticks)
                * phase_table.len() as f64) as u32;
            let phase_rel = (phase_abs + (*start_phase)) % phase_table.len() as u32;
            *phase = Some(phase_rel);
            *relative_position = phase_table[phase_rel as usize];
        }
        _ => panic!("unsupported body movement"),
    }
}

pub fn update_radial_moving_entities(
    location: &Location,
    current_ticks: u64,
    mut sampler: Sampler,
    limit_area: AABB,
    indexes: &GameStateIndexes,
    caches: &mut GameStateCaches,
) -> (Location, Sampler) {
    let mut res = location.clone();
    let bodies = get_radial_bodies_mut(&mut res);
    update_radial_movement(
        current_ticks,
        &mut sampler,
        limit_area.clone(),
        indexes,
        caches,
        bodies,
    );
    let mark = sampler.start(SamplerMarks::RestoreAbsolutePosition as u32);
    if let Some(star_clone) = location.star.clone() {
        let star_root: Box<&dyn IBodyV2> = Box::new(&star_clone as &dyn IBodyV2);
        restore_absolute_positions(star_root, get_radial_bodies_mut(&mut res));
        sampler.end(mark);
        let mark = sampler.start(SamplerMarks::UpdateSelfRotatingMovement as u32);
        let bodies = get_rotating_bodies_mut(&mut res);
        update_self_rotating_movement(current_ticks, limit_area, caches, bodies);
        sampler.end(mark);
    }
    (res, sampler)
}

fn update_self_rotating_movement(
    current_ticks: u64,
    limit_area: AABB,
    caches: &mut GameStateCaches,
    bodies: Vec<Box<&mut dyn IBodyV2>>,
) {
    for mut body in bodies {
        if limit_area.contains_spatial(body.get_spatial()) {
            let phase_table = get_rotation_phase_table(
                &mut caches.rotation_cache,
                &body.get_rotation_movement(),
                body.get_spatial().radius,
            );
            let new_rotation = match &mut body.get_rotation_movement_mut() {
                RotationMovement::Monotonous {
                    phase,
                    full_period_ticks,
                    start_phase,
                } => {
                    if (*full_period_ticks).abs() < 1e-3 || phase_table.len() == 0 {
                        panic!(
                            "bad rotation movement for {:?}: {:?}",
                            body.spec(),
                            body.get_movement()
                        );
                    }
                    let phase_abs = ((current_ticks as i64 % (*full_period_ticks) as i64) as f64
                        / (*full_period_ticks)
                        * phase_table.len() as f64) as u32;
                    let phase_rel = (phase_abs + (*start_phase)) % phase_table.len() as u32;
                    *phase = Some(phase_rel);
                    phase_table[phase_rel as usize]
                }
                _ => panic!("unsupported body movement"),
            };
            body.get_spatial_mut().rotation_rad = new_rotation;
        }
    }
}

pub fn get_radial_bodies_mut(res: &mut Location) -> Vec<Box<&mut dyn IBodyV2>> {
    let mut bodies: Vec<Box<&mut dyn IBodyV2>> = vec![];
    let mut planet_bodies = res
        .planets
        .iter_mut()
        .map(|p| Box::new(p as &mut dyn IBodyV2))
        .collect();
    let mut asteroid_bodies = res
        .asteroids
        .iter_mut()
        .map(|p| Box::new(p as &mut dyn IBodyV2))
        .collect();
    bodies.append(&mut planet_bodies);
    bodies.append(&mut asteroid_bodies);
    bodies
}

pub fn get_rotating_bodies_mut(res: &mut Location) -> Vec<Box<&mut dyn IBodyV2>> {
    let mut bodies: Vec<Box<&mut dyn IBodyV2>> = vec![];
    let mut asteroid_belts = res
        .asteroid_belts
        .iter_mut()
        .map(|p| Box::new(p as &mut dyn IBodyV2))
        .collect();
    bodies.append(&mut asteroid_belts);
    bodies
}

pub fn get_radial_bodies(res: &Location) -> Vec<Box<&dyn IBodyV2>> {
    let mut bodies: Vec<Box<&dyn IBodyV2>> = vec![];
    let mut planet_bodies = res
        .planets
        .iter()
        .map(|p| Box::new(p as &dyn IBodyV2))
        .collect();
    let mut asteroid_bodies = res
        .asteroids
        .iter()
        .map(|p| Box::new(p as &dyn IBodyV2))
        .collect();
    let mut asteroid_belt_bodies = res
        .asteroid_belts
        .iter()
        .map(|p| Box::new(p as &dyn IBodyV2))
        .collect();
    bodies.append(&mut planet_bodies);
    bodies.append(&mut asteroid_bodies);
    bodies.append(&mut asteroid_belt_bodies);
    bodies
}

pub trait Anchored {
    fn get_anchor_dist(&self, indexes: &GameStateIndexes) -> f64;
}

impl Anchored for PlanetV2 {
    fn get_anchor_dist(&self, indexes: &GameStateIndexes) -> f64 {
        generic_get_anchor_dist(self, indexes)
    }
}
