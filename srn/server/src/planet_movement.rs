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
    split_bodies_by_area, Asteroid, MovementDefinition, ObjectProperty, Planet, PlanetV2,
    SpatialProps, Star, AABB,
};
use crate::DEBUG_PHYSICS;
use crate::{vec2, world};

#[clonable]
pub trait IBody: Clone {
    fn get_id(&self) -> Uuid;
    fn get_anchor_id(&self) -> Uuid;
    fn get_x(&self) -> f64;
    fn get_y(&self) -> f64;
    fn get_radius(&self) -> f64;
    fn get_orbit_speed(&self) -> f64;
    fn set_x(&mut self, val: f64);
    fn set_y(&mut self, val: f64);
    fn get_anchor_tier(&self) -> u32;
    fn get_name(&self) -> String;
    fn get_color(&self) -> String;
    fn as_vec(&self) -> Vec2f64;
    fn get_health(&self) -> Option<Health>;
    fn get_properties(&self) -> Vec<ObjectProperty>;
}

#[clonable]
pub trait IBodyV2: Clone {
    fn get_id(&self) -> Uuid;
    fn get_name(&self) -> &String;
    fn get_spatial(&self) -> &SpatialProps<usize>;
    fn get_movement(&self) -> &MovementDefinition;
    fn set_spatial(&mut self, x: SpatialProps<usize>);
}

impl IBodyV2 for PlanetV2 {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_name(&self) -> &String {
        &self.name
    }

    fn get_spatial(&self) -> &SpatialProps<usize> {
        &self.spatial
    }

    fn get_movement(&self) -> &MovementDefinition {
        &self.movement
    }

    fn set_spatial(&mut self, props: SpatialProps<usize>) {
        self.spatial = props;
    }
}

impl IBody for Asteroid {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_anchor_id(&self) -> Uuid {
        self.anchor_id
    }

    fn get_x(&self) -> f64 {
        self.x
    }

    fn get_y(&self) -> f64 {
        self.y
    }

    fn get_radius(&self) -> f64 {
        self.radius
    }

    fn get_orbit_speed(&self) -> f64 {
        self.orbit_speed
    }

    fn set_x(&mut self, val: f64) {
        self.x = val;
    }

    fn set_y(&mut self, val: f64) {
        self.y = val;
    }

    fn get_anchor_tier(&self) -> u32 {
        self.anchor_tier
    }

    fn get_name(&self) -> String {
        format!("asteroid {}", self.id)
    }

    fn get_color(&self) -> String {
        "".to_string()
    }

    fn as_vec(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }

    fn get_health(&self) -> Option<Health> {
        None
    }

    fn get_properties(&self) -> Vec<ObjectProperty> {
        vec![]
    }
}

impl IBody for Planet {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_anchor_id(&self) -> Uuid {
        self.anchor_id
    }

    fn get_x(&self) -> f64 {
        self.x
    }

    fn get_y(&self) -> f64 {
        self.y
    }

    fn get_radius(&self) -> f64 {
        self.radius
    }

    fn get_orbit_speed(&self) -> f64 {
        self.orbit_speed
    }

    fn set_x(&mut self, val: f64) {
        self.x = val
    }

    fn set_y(&mut self, val: f64) {
        self.y = val
    }

    fn get_anchor_tier(&self) -> u32 {
        self.anchor_tier
    }

    fn get_name(&self) -> String {
        self.name.clone()
    }

    fn get_color(&self) -> String {
        self.color.clone()
    }

    fn as_vec(&self) -> Vec2f64 {
        vec2::AsVec2f64::as_vec(self)
    }

    fn get_health(&self) -> Option<Health> {
        self.health.clone()
    }

    fn get_properties(&self) -> Vec<ObjectProperty> {
        self.properties.clone()
    }
}

impl IBody for Star {
    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_anchor_id(&self) -> Uuid {
        Default::default()
    }

    fn get_x(&self) -> f64 {
        self.x
    }

    fn get_y(&self) -> f64 {
        self.y
    }

    fn get_radius(&self) -> f64 {
        self.radius
    }

    fn get_orbit_speed(&self) -> f64 {
        0.0
    }

    fn set_x(&mut self, val: f64) {
        self.x = val
    }

    fn set_y(&mut self, val: f64) {
        self.y = val
    }

    fn get_anchor_tier(&self) -> u32 {
        0
    }

    fn get_name(&self) -> String {
        self.name.clone()
    }

    fn get_color(&self) -> String {
        self.color.clone()
    }

    fn as_vec(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }

    fn get_health(&self) -> Option<Health> {
        None
    }

    fn get_properties(&self) -> Vec<ObjectProperty> {
        vec![]
    }
}

impl From<Box<dyn IBody>> for Planet {
    fn from(val: Box<dyn IBody>) -> Self {
        Planet {
            id: val.get_id(),
            name: val.get_name(),
            x: val.get_x(),
            y: val.get_y(),
            rotation: 0.0,
            radius: val.get_radius(),
            orbit_speed: val.get_orbit_speed(),
            anchor_id: val.get_anchor_id(),
            anchor_tier: val.get_anchor_tier(),
            color: val.get_color(),
            health: val.get_health(),
            properties: val.get_properties(),
        }
    }
}

impl From<Box<dyn IBody>> for Asteroid {
    fn from(val: Box<dyn IBody>) -> Self {
        Asteroid {
            id: val.get_id(),
            x: val.get_x(),
            y: val.get_y(),
            rotation: 0.0,
            radius: val.get_radius(),
            orbit_speed: val.get_orbit_speed(),
            anchor_id: val.get_anchor_id(),
            anchor_tier: val.get_anchor_tier(),
        }
    }
}

pub fn update_planets(
    planets1: &Vec<Planet>,
    star: &Option<Star>,
    elapsed_micro: i64,
    mut sampler: Sampler,
    limit_area: AABB,
) -> (Vec<Planet>, Sampler) {
    let mut shifts = HashMap::new();

    let planets_as_bodies = planets_to_bodies(planets1);
    let (planets_to_update, mut planets_to_ignore) =
        split_bodies_by_area(planets_as_bodies, limit_area);

    let tier1 = planets_to_update
        .iter()
        .filter(|p| p.get_anchor_tier() == 1)
        .collect::<Vec<_>>();
    // tier 1 always rotates the star, and not themselves
    let cloned_tier1 = tier1.iter().map(|p| (*p).clone()).collect::<Vec<_>>();
    let bodies: Vec<Box<dyn IBody>> = make_bodies_from_bodies(&cloned_tier1, star);
    let mut anchors = build_anchors_from_bodies(bodies);

    let mut tier1 = tier1
        .iter()
        .map(|p| {
            let iter = sampler.start(SamplerMarks::UpdatePlanets1 as u32);
            let val =
                simulate_planet_movement(elapsed_micro, &mut anchors, &mut shifts, (*p).clone());
            sampler.end(iter);
            val
        })
        .collect::<Vec<Box<dyn IBody>>>();

    let tier2 = planets_to_update
        .iter()
        .filter(|p| p.get_anchor_tier() == 2)
        .collect::<Vec<_>>();
    // tier 2 always rotates tier 1
    let mut both = vec![];
    for p in tier1.iter() {
        both.push(p.clone())
    }
    for p in tier2.iter() {
        both.push((*p).clone())
    }
    let bodies: Vec<Box<dyn IBody>> = make_bodies_from_bodies(&both, star);
    let mut anchors = build_anchors_from_bodies(bodies);

    let mut tier2 = tier2
        .iter()
        .map(|p| {
            let iter = sampler.start(SamplerMarks::UpdatePlanets1 as u32);
            let val =
                simulate_planet_movement(elapsed_micro, &mut anchors, &mut shifts, (*p).clone());
            sampler.end(iter);
            val
        })
        .collect::<Vec<Box<dyn IBody>>>();

    tier1.append(&mut tier2);
    tier1.append(&mut planets_to_ignore);
    (
        tier1
            .into_iter()
            .map(|p| Planet::from(p))
            .collect::<Vec<_>>(),
        sampler,
    )
}

pub fn update_asteroids(
    asteroids: &Vec<Asteroid>,
    star: &Option<Star>,
    elapsed_micro: i64,
) -> Vec<Asteroid> {
    // asteroids always orbit the star for now, so no point indexing themselves
    let bodies: Vec<Box<dyn IBody>> = make_bodies_from_asteroids(&vec![], star);
    let mut anchors = build_anchors_from_bodies(bodies);

    let mut new_asteroids = asteroids.clone();
    let mut shifts = HashMap::new();

    new_asteroids = new_asteroids
        .iter()
        .map(|p| {
            Asteroid::from(simulate_planet_movement(
                elapsed_micro,
                &mut anchors,
                &mut shifts,
                Box::new(p.clone()),
            ))
        })
        .collect::<Vec<Asteroid>>();

    new_asteroids
}

pub fn build_anchors_from_bodies(bodies: Vec<Box<dyn IBody>>) -> HashMap<Uuid, Box<dyn IBody>> {
    let by_id = index_bodies_by_id(bodies.clone());
    let mut anchors = HashMap::new();
    for p in bodies.into_iter() {
        let anchor_id = p.get_anchor_id();
        let anchor_body = by_id.get(&anchor_id);
        if let Some(anchor) = anchor_body {
            anchors.entry(anchor_id).or_insert((*anchor).clone());
        }
    }
    anchors
}

pub fn index_bodies_by_id(bodies: Vec<Box<dyn IBody>>) -> HashMap<Uuid, Box<dyn IBody>> {
    let mut by_id = HashMap::new();
    for p in bodies {
        by_id.entry(p.get_id()).or_insert(p);
    }
    by_id
}

pub fn make_bodies_from_planets(planets: &Vec<Planet>, star: &Option<Star>) -> Vec<Box<dyn IBody>> {
    let mut res = planets_to_bodies(planets);
    if let Some(star) = star {
        res.push(Box::new(star.clone()));
    }
    res
}

pub fn make_bodies_from_bodies(
    bodies: &Vec<Box<dyn IBody>>,
    star: &Option<Star>,
) -> Vec<Box<dyn IBody>> {
    let mut res = bodies.clone();
    if let Some(star) = star {
        res.push(Box::new(star.clone()));
    }
    res
}

fn planets_to_bodies(planets: &Vec<Planet>) -> Vec<Box<dyn IBody>> {
    let mut res: Vec<Box<dyn IBody>> = vec![];
    for planet in planets {
        res.push(Box::new(planet.clone()));
    }
    res
}

pub fn make_bodies_from_asteroids(
    asteroids: &Vec<Asteroid>,
    star: &Option<Star>,
) -> Vec<Box<dyn IBody>> {
    let mut res: Vec<Box<dyn IBody>> = vec![];
    for ast in asteroids {
        res.push(Box::new(ast.clone()));
    }
    if let Some(star) = star {
        res.push(Box::new(star.clone()));
    }
    res
}

static ZERO: Vec2f64 = Vec2f64 { x: 0.0, y: 0.0 };

pub fn simulate_planet_movement(
    elapsed_micro: i64,
    anchors: &HashMap<Uuid, Box<dyn IBody>>,
    shifts: &mut HashMap<Uuid, Vec2f64>,
    mut p: Box<dyn IBody>,
) -> Box<dyn IBody> {
    let p_id = p.get_id();
    let p_anchor_id = p.get_anchor_id();
    let p_x = p.get_x();
    let p_y = p.get_y();

    if DEBUG_PHYSICS {
        println!("p {} elapsed {}", p_id, elapsed_micro);
    }

    let anchor = anchors.get(&p_anchor_id).unwrap();
    let anchor_x = anchor.get_x();
    let anchor_y = anchor.get_y();

    if DEBUG_PHYSICS {
        println!("anchor position {}/{}", anchor_x, anchor_y);
    }

    let anchor_shift = shifts.get(&p_anchor_id).unwrap_or(&ZERO);

    if DEBUG_PHYSICS {
        println!("anchor shift {}", anchor_shift.as_key(Precision::P2))
    }

    let current_pos_relative = Vec2f64 {
        x: p_x + anchor_shift.x - anchor_x,
        y: p_y + anchor_shift.y - anchor_y,
    };

    let old = Vec2f64 { x: p_x, y: p_y };
    if DEBUG_PHYSICS {
        println!("current {}", current_pos_relative);
    }

    let orbit_length = current_pos_relative.euclidean_len();

    let base_vec = Vec2f64 {
        x: orbit_length,
        y: 0.0,
    };
    let mut current_angle = base_vec.angle_rad(&current_pos_relative);
    if current_pos_relative.y > 0.0 {
        current_angle = 2.0 * PI - current_angle;
    }
    if DEBUG_PHYSICS {
        eprintln!("name {}", p.get_name());
        eprintln!("anchor {}/{}", anchor_x, anchor_y);
        eprintln!("base_vec {}/{}", base_vec.x, base_vec.y);
        eprintln!("dist {}", orbit_length);
    }

    let angle_diff = p.get_orbit_speed() * (elapsed_micro as f64) / 1000.0 / 1000.0;
    if DEBUG_PHYSICS {
        println!("current angle: {}", current_angle);
        println!("angle diff: {}", angle_diff);
    }
    let new_angle = (current_angle + angle_diff) % (2.0 * PI);
    if DEBUG_PHYSICS {
        println!("new_angle: {}", new_angle);
    }
    let new_vec = base_vec.rotate(new_angle);
    p.set_x(anchor_x + new_vec.x);
    p.set_y(anchor_y + new_vec.y);
    if DEBUG_PHYSICS {
        println!("new_vec {}", new_vec);
    }
    if DEBUG_PHYSICS {
        println!("new pos {}", p.as_vec());
    }
    shifts.insert(p_id, p.as_vec().subtract(&old));
    return p;
}
