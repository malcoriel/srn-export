use std::collections::HashMap;

use crate::vec2::{AsVec2f64, Precision, Vec2f64};
use crate::world::{index_planets_by_id, Asteroid, Planet, Star};
use crate::DEBUG_PHYSICS;
use crate::{vec2, world};
use objekt_clonable::*;
use std::f64::consts::PI;
use uuid::Uuid;

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
    planets: &Vec<Planet>,
    star: &Option<Star>,
    elapsed_micro: i64,
) -> Vec<Planet> {
    let bodies: Vec<Box<dyn IBody>> = make_bodies_from_planets(planets, star);
    let by_id = index_bodies_by_id(bodies.clone());
    let mut anchors = build_anchors_from_bodies(bodies, &by_id);

    let mut planets = planets.clone();
    let mut shifts = HashMap::new();

    for tier in 1..3 {
        planets = planets
            .iter()
            .map(|p| {
                Planet::from(simulate_planet_movement(
                    elapsed_micro,
                    &mut anchors,
                    &mut shifts,
                    tier,
                    Box::new(p.clone()),
                ))
            })
            .collect::<Vec<Planet>>();
    }

    planets
}

pub fn update_asteroids(
    asteroids: &Vec<Asteroid>,
    star: &Option<Star>,
    elapsed_micro: i64,
) -> Vec<Asteroid> {
    let bodies: Vec<Box<dyn IBody>> = make_bodies_from_asteroids(asteroids, star);
    let by_id = index_bodies_by_id(bodies.clone());
    let mut anchors = build_anchors_from_bodies(bodies, &by_id);

    let mut new_asteroids = asteroids.clone();
    let mut shifts = HashMap::new();

    new_asteroids = new_asteroids
        .iter()
        .map(|p| {
            Asteroid::from(simulate_planet_movement(
                elapsed_micro,
                &mut anchors,
                &mut shifts,
                1,
                Box::new(p.clone()),
            ))
        })
        .collect::<Vec<Asteroid>>();

    new_asteroids
}

pub fn build_anchors_from_bodies(
    bodies: Vec<Box<dyn IBody>>,
    by_id: &HashMap<Uuid, Box<dyn IBody>>,
) -> HashMap<Uuid, Box<dyn IBody>> {
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
    let mut res: Vec<Box<dyn IBody>> = vec![];
    for planet in planets {
        res.push(Box::new(planet.clone()));
    }
    if let Some(star) = star {
        res.push(Box::new(star.clone()));
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

pub fn simulate_planet_movement(
    elapsed_micro: i64,
    anchors: &mut HashMap<Uuid, Box<dyn IBody>>,
    shifts: &mut HashMap<Uuid, Vec2f64>,
    tier: u32,
    p: Box<dyn IBody>,
) -> Box<dyn IBody> {
    let mut p = p.clone();

    if p.get_anchor_tier() != tier {
        if DEBUG_PHYSICS {
            eprintln!(
                "skipping {} (tier {}) for tier {}",
                p.get_name(),
                p.get_anchor_tier(),
                tier
            );
        }
        return p;
    }

    if DEBUG_PHYSICS {
        println!("p {} elapsed {}", p.get_id(), elapsed_micro);
    }
    let anchor = anchors.get(&p.get_anchor_id()).unwrap();

    if DEBUG_PHYSICS {
        println!("anchor position {}/{}", anchor.get_x(), anchor.get_y());
    }

    let anchor_shift = shifts
        .get(&p.get_anchor_id())
        .unwrap_or(&Vec2f64 { x: 0.0, y: 0.0 });

    if DEBUG_PHYSICS {
        println!("anchor shift {}", anchor_shift.as_key(Precision::P2))
    }

    let current_pos_relative = Vec2f64 {
        x: p.get_x() + anchor_shift.x - anchor.get_x(),
        y: p.get_y() + anchor_shift.y - anchor.get_y(),
    };

    let old = Vec2f64 {
        x: p.get_x(),
        y: p.get_y(),
    };
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
        eprintln!("anchor {}/{}", anchor.get_x(), anchor.get_y());
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
    p.set_x(anchor.get_x() + new_vec.x);
    p.set_y(anchor.get_y() + new_vec.y);
    if DEBUG_PHYSICS {
        println!("new_vec {}", new_vec);
    }
    if DEBUG_PHYSICS {
        println!("new pos {}", p.as_vec());
    }
    anchors.remove_entry(&p.get_id());
    anchors.insert(p.get_id(), p.clone());
    shifts.insert(p.get_id(), p.as_vec().subtract(&old));
    return p;
}
