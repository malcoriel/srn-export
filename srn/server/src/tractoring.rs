use std::any::Any;
use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;

use objekt_clonable::*;
use objekt_clonable::*;
use uuid::Uuid;

use crate::vec2::Vec2f64;
use crate::world::{Container, NatSpawnMineral, Player, PlayerId, Ship};
use crate::{indexing, world};

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
    if let Some(position) = find_tractorable_item_position(&minerals, &containers, t) {
        let dist = ship.spatial.position.euclidean_distance(&position);
        if dist <= MAX_TRACTOR_DIST {
            ship.tractor_target = Some(t);
        } else {
            ship.tractor_target = None;
        }
    } else {
        ship.tractor_target = None;
    }
}

const TRACTOR_SPEED_PER_SEC: f64 = 10.0;
const TRACTOR_PICKUP_DIST: f64 = 1.0;

pub fn update_tractored_objects(
    ships: &Vec<Ship>,
    objects: &mut Vec<Box<dyn IMovable>>,
    elapsed: i64,
    players: &Vec<Player>,
) -> Vec<(PlayerId, Box<dyn IMovable>)> {
    let ship_by_tractor = indexing::index_ships_by_tractor_target(ships);
    let players_by_ship_id = indexing::index_players_by_ship_id(players);
    let mut players_update = vec![];
    let mut ids_to_remove = HashSet::new();
    for object in objects.iter_mut() {
        if let Some(ships) = ship_by_tractor.get(&object.get_id()) {
            let old_pos = object.get_position();
            let mut is_consumed = false;
            for ship in ships {
                let dist = ship.spatial.position.subtract(&old_pos);
                let dir = dist.normalize();
                if let Some(dir) = dir {
                    if dist.euclidean_len() < TRACTOR_PICKUP_DIST {
                        if let Some(p) = players_by_ship_id.get(&ship.id) {
                            players_update.push((p.id, object.clone()))
                        }
                        is_consumed = true;
                    } else {
                        let scaled = dir
                            .scalar_mul(TRACTOR_SPEED_PER_SEC * elapsed as f64 / 1000.0 / 1000.0);

                        object.set_position(old_pos.add(&scaled));
                    }
                }
            }
            if is_consumed {
                ids_to_remove.insert(object.get_id());
            }
        }
    }

    objects.retain(|o| !ids_to_remove.contains(&o.get_id()));
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

pub struct MovablesContainerBase {
    pub movables: Vec<Box<dyn IMovable>>,
}

impl MovablesContainerBase {
    pub fn new_minerals(minerals: Vec<NatSpawnMineral>) -> Self {
        let res = Vec::from_iter(
            minerals
                .into_iter()
                .map(|m| Box::new(m) as Box<dyn IMovable>),
        );
        MovablesContainerBase { movables: res }
    }

    pub fn new_containers(minerals: Vec<Container>) -> Self {
        let res = Vec::from_iter(
            minerals
                .into_iter()
                .map(|m| Box::new(m) as Box<dyn IMovable>),
        );
        MovablesContainerBase { movables: res }
    }

    pub fn get_minerals(&self) -> Vec<NatSpawnMineral> {
        return Vec::from_iter(self.movables.iter().map(|m| {
            m.as_any()
                .downcast_ref::<NatSpawnMineral>()
                .unwrap()
                .clone()
        }));
    }

    pub fn get_containers(&self) -> Vec<Container> {
        return Vec::from_iter(
            self.movables
                .iter()
                .map(|m| m.as_any().downcast_ref::<Container>().unwrap().clone()),
        );
    }
}

impl MineralsContainer {
    pub fn new(minerals: Vec<NatSpawnMineral>) -> Self {
        let res = Vec::from_iter(
            minerals
                .into_iter()
                .map(|m| Box::new(m) as Box<dyn IMovable>),
        );
        MineralsContainer { minerals: res }
    }

    pub fn get_minerals(&self) -> Vec<NatSpawnMineral> {
        return Vec::from_iter(self.minerals.iter().map(|m| {
            m.as_any()
                .downcast_ref::<NatSpawnMineral>()
                .unwrap()
                .clone()
        }));
    }
}

pub struct ContainersContainer {
    pub containers: Vec<Box<dyn IMovable>>,
}

impl ContainersContainer {
    pub fn new(containers: Vec<Container>) -> Self {
        let res = Vec::from_iter(
            containers
                .into_iter()
                .map(|c| Box::new(c) as Box<dyn IMovable>),
        );
        Self { containers: res }
    }

    pub fn get_containers(&self) -> Vec<Container> {
        let mut res = vec![];
        for cont in self.containers.clone() {
            res.push(cont.as_any().downcast_ref::<Container>().unwrap().clone())
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

impl MovablesContainer for MovablesContainerBase {
    fn mut_movables(&mut self) -> &mut Vec<Box<dyn IMovable>> {
        &mut self.movables
    }
    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl MovablesContainer for ContainersContainer {
    fn mut_movables(&mut self) -> &mut Vec<Box<dyn IMovable>> {
        &mut self.containers
    }
    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub enum IMovableType {
    NatSpawnMineral,
    Container,
}

#[clonable]
pub trait IMovable: Clone {
    fn set_position(&mut self, pos: Vec2f64);
    fn get_position(&self) -> Vec2f64;
    fn get_id(&self) -> Uuid;
    fn get_type(&self) -> IMovableType;
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

    fn get_type(&self) -> IMovableType {
        IMovableType::NatSpawnMineral
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl IMovable for Container {
    fn set_position(&mut self, pos: Vec2f64) {
        self.position = pos;
    }

    fn get_position(&self) -> Vec2f64 {
        self.position.clone()
    }

    fn get_id(&self) -> Uuid {
        self.id
    }

    fn get_type(&self) -> IMovableType {
        IMovableType::Container
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

pub fn find_tractorable_item_position(
    minerals: &Vec<NatSpawnMineral>,
    containers: &Vec<Container>,
    target_id: Uuid,
) -> Option<Vec2f64> {
    let mineral = minerals.iter().find(|mineral| mineral.id == target_id);
    let container = containers.iter().find(|cont| cont.id == target_id);
    if let Some(mineral) = mineral {
        return Some(Vec2f64 {
            x: mineral.x,
            y: mineral.y,
        });
    } else if let Some(container) = container {
        return Some(container.position.clone());
    }
    return None;
}
