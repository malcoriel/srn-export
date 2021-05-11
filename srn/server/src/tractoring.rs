use std::collections::HashMap;

use uuid::Uuid;

use crate::vec2::Vec2f64;
use crate::world;
use crate::world::{Container, IMovable, NatSpawnMineral, Player, PlayerId, Ship};

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
    objects: &Vec<Box<dyn IMovable>>,
    elapsed: i64,
    players: &Vec<Player>,
) -> (Vec<Box<dyn IMovable>>, Vec<(PlayerId, Box<dyn IMovable>)>) {
    let ship_by_tractor = index_ships_by_tractor_target(ships);
    let players_by_ship_id = world::index_players_by_ship_id(players);
    let mut players_update = vec![];
    let minerals = objects
        .iter()
        .map(|m| {
            let mut m = (*m).clone();
            return if let Some(ships) = ship_by_tractor.get(&m.get_id()) {
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
                        let scaled = dir
                            .scalar_mul(TRACTOR_SPEED_PER_SEC * elapsed as f64 / 1000.0 / 1000.0);

                        m.set_position(old_pos.add(&scaled));
                    }
                }
                if is_consumed {
                    None
                } else {
                    Some(m)
                }
            } else {
                Some(m)
            };
        })
        .filter_map(|m| m)
        .collect::<Vec<_>>();
    (minerals, players_update)
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

pub fn containers_to_imovables(p0: &Vec<Container>) -> &Vec<Box<dyn IMovable>> {
    todo!()
}

pub fn minerals_to_imovables(p0: &Vec<NatSpawnMineral>) -> &Vec<Box<dyn IMovable>> {
    todo!()
}
