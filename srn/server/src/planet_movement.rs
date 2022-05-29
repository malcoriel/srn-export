use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;

use itertools::{chain, Itertools};
use objekt_clonable::*;
use uuid::Uuid;

use crate::combat::Health;
use crate::indexing::{GameStateIndexes, index_planets_by_id, Spec, GameStateCaches, ObjectSpecifier};
use crate::perf::Sampler;
use crate::perf::SamplerMarks;
use crate::vec2::{AsVec2f64, Precision, Vec2f64};
use crate::world::{Asteroid, Movement, ObjectProperty, PlanetV2, SpatialProps, Star, AABB, AsteroidBelt, Location};
use crate::{DEBUG_PHYSICS};
use crate::{vec2, world};
use crate::interpolation::{get_phase_table, restore_absolute_positions};

#[clonable]
pub trait IBodyV2: Clone + Anchored + Spec {
    fn get_id(&self) -> Uuid;
    fn get_name(&self) -> &String;
    fn get_spatial(&self) -> &SpatialProps;
    fn get_spatial_mut(&mut self) -> &mut SpatialProps;
    fn get_movement(&self) -> &Movement;
    fn get_movement_mut(&mut self) -> &mut Movement;
    fn set_spatial(&mut self, x: SpatialProps);
    fn get_anchor_tier(&self) -> u32;
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

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps) {
        self.spatial = props;
    }

    fn get_anchor_tier(&self) -> u32 {
        self.anchor_tier
    }
}

impl Anchored for Star {
    fn get_anchor_dist(&self, _indexes: &GameStateIndexes) -> f64 {
        0.0
    }
}

impl Spec for Star {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::Star {
            id: self.id
        }
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

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps) {
        self.spatial = props;
    }

    fn get_anchor_tier(&self) -> u32 {
        0
    }
}

impl Spec for Asteroid {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::Asteroid {
            id: self.id
        }
    }
}

pub fn generic_get_anchor_dist<T : Spec>(arg: &T, indexes: &GameStateIndexes) -> f64 {
    let specifier = arg.spec();
    *indexes.anchor_distances.get(&specifier).expect(format!("No anchor distance found for {:?}", specifier).as_str())

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

    fn get_movement_mut(&mut self) -> &mut Movement {
        &mut self.movement
    }

    fn set_spatial(&mut self, x: SpatialProps) {
        self.spatial = x;
    }

    fn get_anchor_tier(&self) -> u32 {
        1
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



fn update_radial_movement(current_ticks: i64, sampler: &mut Sampler, limit_area: AABB, indexes: &GameStateIndexes, caches: &mut GameStateCaches, bodies: Vec<Box<&mut dyn IBodyV2>>) {
    for mut body in bodies {
        let mark = sampler.start(SamplerMarks::UpdateRadialMovement as u32);
        if limit_area.contains_vec(&body.get_spatial().position) {
            let phase_table = get_phase_table(&mut caches.rel_orbit_cache, &body.get_movement(), body.get_anchor_dist(indexes));
            match &mut body.get_movement_mut() {
                Movement::RadialMonotonous {
                    relative_position, phase, full_period_ticks, start_phase, ..
                } => {
                    if (*full_period_ticks).abs() < 1e-3 {
                        panic!("bad movement for {:?}", body.spec());
                    }
                    let phase_abs = ((current_ticks as i64 % (*full_period_ticks) as i64) as f64 / (*full_period_ticks) * phase_table.len() as f64) as u32;
                    let phase_rel = (phase_abs + (*start_phase)) % phase_table.len() as u32;
                    *phase = Some(phase_rel);
                    *relative_position = phase_table[phase_rel as usize];
                }
                _ => panic!("unsupported body movement"),
            }
        }
        sampler.end(mark);
    }
}

pub fn update_planets(location: &Location, current_ticks: i64, mut sampler: Sampler, limit_area: AABB, indexes: &GameStateIndexes, caches: &mut GameStateCaches) -> (Location, Sampler) {
    let mut res = location.clone();
    let bodies: Vec<Box<&mut dyn IBodyV2>> = res.planets.iter_mut().map(|p| Box::new(p as &mut dyn IBodyV2)).collect();
    update_radial_movement(current_ticks, &mut sampler, limit_area, indexes, caches, bodies);
    let mark = sampler.start(SamplerMarks::RestoreAbsolutePosition as u32);
    let star_clone = location.star.clone().expect("cannot update planets radial movement in a location without a star");
    let star_root: Box<&dyn IBodyV2> = Box::new(&star_clone as &dyn IBodyV2);
    restore_absolute_positions(star_root,res.planets.iter_mut().map(|p| Box::new(p as &mut dyn IBodyV2)).collect());
    sampler.end(mark);
    (res, sampler)
}

pub fn update_asteroids(location: &Location, current_ticks: i64, mut sampler: Sampler, limit_area: AABB, indexes: &GameStateIndexes, caches: &mut GameStateCaches) -> (Location, Sampler) {
    let mut res = location.clone();
    let bodies: Vec<Box<&mut dyn IBodyV2>> = res.asteroids.iter_mut().map(|p| Box::new(p as &mut dyn IBodyV2)).collect();
    update_radial_movement(current_ticks, &mut sampler, limit_area, indexes, caches, bodies);
    let mark = sampler.start(SamplerMarks::RestoreAbsolutePosition as u32);
    let star_clone = location.star.clone().expect("cannot update asteroids radial movement in a location without a star");
    let star_root: Box<&dyn IBodyV2> = Box::new(&star_clone as &dyn IBodyV2);
    restore_absolute_positions(star_root,res.asteroids.iter_mut().map(|p| Box::new(p as &mut dyn IBodyV2)).collect());
    sampler.end(mark);
    (res, sampler)
}

pub fn update_asteroid_belts(belt: &mut AsteroidBelt, star_clone: &Option<Star>) {
    todo!()
}

pub trait Anchored {
    fn get_anchor_dist(&self, indexes: &GameStateIndexes) -> f64;
}

impl Anchored for PlanetV2 {
    fn get_anchor_dist(&self, indexes: &GameStateIndexes) -> f64 {
        generic_get_anchor_dist(self, indexes)
    }
}
