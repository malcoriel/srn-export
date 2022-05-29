use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;

use itertools::chain;
use objekt_clonable::*;
use uuid::Uuid;

use crate::combat::Health;
use crate::indexing::index_planets_by_id;
use crate::perf::Sampler;
use crate::perf::SamplerMarks;
use crate::vec2::{AsVec2f64, Precision, Vec2f64};
use crate::world::{
    Asteroid, Movement, ObjectProperty, PlanetV2, SpatialProps, Star,
    AABB,
};
use crate::DEBUG_PHYSICS;
use crate::{vec2, world};

#[clonable]
pub trait IBodyV2: Clone {
    fn get_id(&self) -> Uuid;
    fn get_name(&self) -> &String;
    fn get_spatial(&self) -> &SpatialProps;
    fn get_movement(&self) -> &Movement;
    fn set_spatial(&mut self, x: SpatialProps);
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

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps) {
        self.spatial = props;
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

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps) {
        self.spatial = props;
    }
}

impl IBodyV2 for Asteroid {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_name(&self) -> &String {
        &"".to_string()
    }

    fn get_spatial(&self) -> &SpatialProps {
        &self.spatial
    }

    fn get_movement(&self) -> &Movement {
        &self.movement
    }

    fn set_spatial(&mut self, x: SpatialProps) {
        self.spatial = x;
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
