use objekt_clonable::*;
use std::any::Any;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use objekt_clonable::*;

use crate::vec2::Vec2f64;
use crate::world;
use crate::world::{Container, NatSpawnMineral, Player, PlayerId, Ship};
use std::iter::FromIterator;

pub fn update_ships_tractoring(
    ships: &Vec<Ship>,
    minerals: &Vec<NatSpawnMineral>,
    containers: &Vec<Container>,
) -> Vec<Ship> {
    ships
        .iter()
        .map(|s| {
            let mut s = s.clone();
            if let Some(target) = s.tractor_target {
                update_ship_tractor(target, &mut s, minerals, containers);
            }
            s
        })
        .collect::<Vec<_>>()
}

const MAX_TRACTOR_DIST: f64 = 30.0;

pub fn update_ship_tractor(
    t: Uuid,
    ship: &mut Ship,
    minerals: &Vec<NatSpawnMineral>,
    containers: &Vec<Container>,
) {
    if let Some(position) = world::find_tractorable_item_position(&minerals, &containers, t) {
        let dist = Vec2f64 {
            x: ship.x,
            y: ship.y,
        }
        .euclidean_distance(&position);
        if dist <= MAX_TRACTOR_DIST {
            ship.tractor_target = Some(t);
        } else {
            ship.tractor_target = None;
        }
    } else {
        ship.tractor_target = None;
    }
}

pub fn index_ships_by_tractor_target(ships: &Vec<Ship>) -> HashMap<Uuid, Vec<&Ship>> {
    let mut by_target = HashMap::new();
    for p in ships.iter() {
        if let Some(tt) = p.tractor_target {
            let entry = by_target.entry(tt).or_insert(vec![]);
            entry.push(p);
        }
    }
    by_target
}

const TRACTOR_SPEED_PER_SEC: f64 = 10.0;
const TRACTOR_PICKUP_DIST: f64 = 1.0;

pub fn update_tractored_objects(
    ships: &Vec<Ship>,
    objects: &mut Box<dyn MovablesContainer>,
    elapsed: i64,
    players: &Vec<Player>,
) -> Vec<(PlayerId, Box<dyn IMovable>)> {
    let ship_by_tractor = index_ships_by_tractor_target(ships);
    let players_by_ship_id = world::index_players_by_ship_id(players);
    let mut players_update = vec![];
    let mut ids_to_remove = HashSet::new();
    for m in objects.mut_movables().iter_mut() {
        if let Some(ships) = ship_by_tractor.get(&m.get_id()) {
            let old_pos = m.get_position();
            let mut is_consumed = false;
            for ship in ships {
                let dist = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                }
                .subtract(&old_pos);
                let dir = dist.normalize();
                if dist.euclidean_len() < TRACTOR_PICKUP_DIST {
                    if let Some(p) = players_by_ship_id.get(&ship.id) {
                        players_update.push((p.id, m.clone()))
                    }
                    is_consumed = true;
                } else {
                    let scaled =
                        dir.scalar_mul(TRACTOR_SPEED_PER_SEC * elapsed as f64 / 1000.0 / 1000.0);

                    m.set_position(old_pos.add(&scaled));
                }
            }
            if is_consumed {
                ids_to_remove.insert(m.get_id());
            }
        }
    }

    objects
        .mut_movables()
        .retain(|o| !ids_to_remove.contains(&o.get_id()));
    players_update
}

impl From<Box<dyn IMovable>> for NatSpawnMineral {
    fn from(_mov: Box<dyn IMovable>) -> Self {
        todo!()
    }
}

impl From<Box<dyn IMovable>> for Container {
    fn from(_mov: Box<dyn IMovable>) -> Self {
        todo!()
    }
}

pub fn containers_to_imovables(_p0: &Vec<Container>) -> &Vec<Box<dyn IMovable>> {
    todo!()
}

pub struct MineralsContainer {
    pub minerals: Vec<Box<dyn IMovable>>,
}

impl MineralsContainer {
    pub fn new(minerals: Vec<NatSpawnMineral>) -> Self {
        let mut res = vec![];
        for min in minerals.into_iter() {
            res.push(Box::new(min) as Box<dyn IMovable>);
        }
        MineralsContainer { minerals: res }
    }

    pub fn get_minerals(&self) -> Vec<NatSpawnMineral> {
        let mut res = vec![];
        for min in self.minerals.clone() {
            res.push(
                min.as_any()
                    .downcast_ref::<NatSpawnMineral>()
                    .unwrap()
                    .clone(),
            )
        }
        res
    }
}

pub trait MovablesContainer {
    fn mut_movables(&mut self) -> &mut Vec<Box<dyn IMovable>>;
    fn as_any(&self) -> &dyn Any;
}

impl MovablesContainer for MineralsContainer {
    fn mut_movables(&mut self) -> &mut Vec<Box<dyn IMovable>> {
        &mut self.minerals
    }
    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[clonable]
pub trait IMovable: Clone {
    fn set_position(&mut self, pos: Vec2f64);
    fn get_position(&self) -> Vec2f64;
    fn get_id(&self) -> Uuid;
    fn as_any(&self) -> &dyn Any;
}

impl IMovable for NatSpawnMineral {
    fn set_position(&mut self, pos: Vec2f64) {
        self.x = pos.x;
        self.y = pos.y;
    }

    fn get_position(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }

    fn get_id(&self) -> Uuid {
        self.id
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}
