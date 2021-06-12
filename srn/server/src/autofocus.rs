use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier, ObjectSpecifier};
use crate::vec2::Vec2f64;
use crate::world::{GameState, Location};
use itertools::sorted;
use kdbush::KDBush;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use uuid::Uuid;

// pub struct DistPair {
//     pub from: ObjectSpecifier,
//     pub to: ObjectSpecifier,
// }
//
// impl Hash for DistPair {
//     fn hash<H: Hasher>(&self, state: &mut H) {}
// }
//
// impl DistPair {
//     pub fn new(from: ObjectSpecifier, to: ObjectSpecifier) -> Self {
//         Self { from, to }
//     }
// }
//
// pub struct DistCache {
//     mem: HashMap<DistPair, f64>,
// }
//
// impl DistCache {
//     pub fn new() -> Self {
//         DistCache {
//             mem: Default::default(),
//         }
//     }
//
//     pub fn dist(state: &GameStateIndexes, key: &DistPair) -> f64 {
//         let from_pos = DistCache::extract_pos(state, &key.from);
//         let to_pos = DistCache::extract_pos(state, &key.to);
//         if from_pos.is_none() || to_pos.is_none() {
//             return f64::INFINITY;
//         }
//         return from_pos.unwrap().euclidean_distance(&to_pos.unwrap());
//     }
//
//     fn extract_pos(state: &GameStateIndexes, specifier: &ObjectSpecifier) -> Option<Vec2f64> {
//         match specifier {
//             ObjectSpecifier::Unknown => None,
//             ObjectSpecifier::Mineral { .. } => None,
//             ObjectSpecifier::Container { .. } => None,
//             ObjectSpecifier::Planet { id } => state
//                 .planets_by_id
//                 .get(&id)
//                 .map_or_else(|p| Some(Vec2f64 { x: p.x, y: p.y })),
//             ObjectSpecifier::Ship { .. } => None,
//             ObjectSpecifier::Star => None,
//         }
//     }
//
//     pub fn get_or_set(
//         &mut self,
//         &state: GameStateIndexes,
//         from: ObjectSpecifier,
//         to: ObjectSpecifier,
//     ) -> f64 {
//         let key = DistPair::new(from, to);
//         let val = self
//             .mem
//             .entry(key)
//             .or_insert_with_key(|k| DistCache::dist(state, k));
//         *val
//     }
// }

pub struct SpatialIndex {
    loc_idx: usize,
    index: KDBush,
    refs: Vec<ObjectIndexSpecifier>,
}

impl SpatialIndex {
    pub fn new(loc_idx: usize, index: KDBush, refs: Vec<ObjectIndexSpecifier>) -> Self {
        Self {
            loc_idx,
            index,
            refs,
        }
    }

    pub fn rad_search(&self, around: &Vec2f64, radius: f64) -> Vec<ObjectIndexSpecifier> {
        let mut results = vec![];
        self.index.within(around.x, around.y, radius, |p| {
            if let Some(ref_obj) = self.refs.get(p) {
                results.push(ref_obj.clone());
            }
        });
        results
    }

    pub fn aabb_search(
        &self,
        _left_top: &Vec2f64,
        _right_bottom: &Vec2f64,
    ) -> Vec<ObjectIndexSpecifier> {
        vec![]
    }
}

fn build_spatial_index(loc: &Location, loc_idx: usize) -> SpatialIndex {
    let count = loc.planets.len() + loc.ships.len() + loc.minerals.len() + loc.containers.len() + 1;
    let mut refs = Vec::with_capacity(count);
    let mut points = Vec::with_capacity(count);
    for i in 0..loc.planets.len() {
        let p = &loc.planets[i];
        refs.push(ObjectIndexSpecifier::Planet { idx: i });
        points.push((p.x, p.y));
    }
    for i in 0..loc.ships.len() {
        let s = &loc.ships[i];
        refs.push(ObjectIndexSpecifier::Ship { idx: i });
        points.push((s.x, s.y));
    }
    for i in 0..loc.minerals.len() {
        let m = &loc.minerals[i];
        refs.push(ObjectIndexSpecifier::Mineral { idx: i });
        points.push((m.x, m.y));
    }
    for i in 0..loc.containers.len() {
        let c = &loc.containers[i];
        refs.push(ObjectIndexSpecifier::Container { idx: i });
        points.push((c.position.x, c.position.y));
    }
    let index = KDBush::create(points, kdbush::DEFAULT_NODE_SIZE);
    SpatialIndex::new(loc_idx, index, refs)
}

pub const AUTOFOCUS_RADIUS: f64 = 30.0;

pub fn update_autofocus_full(state: &mut GameState) {
    for i in 0..state.locations.len() {
        let loc = &mut state.locations[i];
        update_location_autofocus(i, loc)
    }
}

pub fn update_location_autofocus(i: usize, loc: &mut Location) {
    let index = build_spatial_index(&loc, i);
    let mut ship_mods = vec![];
    for ship in loc.ships.iter() {
        let ship_pos = Vec2f64 {
            x: ship.x,
            y: ship.y,
        };
        let around_unfiltered = index.rad_search(&ship_pos, AUTOFOCUS_RADIUS);
        let mut around = around_unfiltered
            .iter()
            .filter(|sp| {
                return match sp {
                    ObjectIndexSpecifier::Ship { .. } => {
                        if let Some(osp) = object_index_into_object_id(&sp, loc) {
                            match osp {
                                ObjectSpecifier::Ship { id } => id != ship.id,
                                _ => true,
                            }
                        } else {
                            true
                        }
                    }
                    _ => true,
                };
            })
            .collect::<Vec<_>>();
        around.sort_by(|a, b| {
            let a_pos = get_position(&loc, a);
            let a_dist = a_pos.map_or(f64::INFINITY, |p| p.euclidean_distance(&ship_pos));
            let b_pos = get_position(&loc, b);
            let b_dist = b_pos.map_or(f64::INFINITY, |p| p.euclidean_distance(&ship_pos));
            if !b_dist.is_finite() || !a_dist.is_finite() {
                return Ordering::Equal;
            }
            a_dist.partial_cmp(&b_dist).unwrap()
        });
        ship_mods.push(
            around
                .get(0)
                .and_then(|ois| object_index_into_object_id(ois, &loc)),
        )
    }
    for i in 0..loc.ships.len() {
        let ship = &mut loc.ships[i];
        ship.auto_focus = ship_mods[i].clone();
    }
}

fn object_index_into_object_id(
    ois: &ObjectIndexSpecifier,
    loc: &Location,
) -> Option<ObjectSpecifier> {
    match ois {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { idx } => loc
            .minerals
            .get(*idx)
            .map(|o| ObjectSpecifier::Mineral { id: o.id }),
        ObjectIndexSpecifier::Container { idx } => loc
            .containers
            .get(*idx)
            .map(|o| ObjectSpecifier::Container { id: o.id }),
        ObjectIndexSpecifier::Planet { idx } => loc
            .planets
            .get(*idx)
            .map(|o| ObjectSpecifier::Planet { id: o.id }),
        ObjectIndexSpecifier::Ship { idx } => loc
            .ships
            .get(*idx)
            .map(|o| ObjectSpecifier::Ship { id: o.id }),
        ObjectIndexSpecifier::Star => loc
            .star
            .as_ref()
            .map(|s| ObjectSpecifier::Star { id: s.id }),
    }
}

fn get_position(loc: &Location, sp: &ObjectIndexSpecifier) -> Option<Vec2f64> {
    match sp {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { idx } => {
            loc.minerals.get(*idx).map(|m| Vec2f64 { x: m.x, y: m.y })
        }
        ObjectIndexSpecifier::Container { idx } => {
            loc.containers.get(*idx).map(|c| c.position.clone())
        }
        ObjectIndexSpecifier::Planet { idx } => {
            loc.planets.get(*idx).map(|o| Vec2f64 { x: o.x, y: o.y })
        }
        ObjectIndexSpecifier::Ship { idx } => {
            loc.ships.get(*idx).map(|s| Vec2f64 { x: s.x, y: s.y })
        }
        ObjectIndexSpecifier::Star => loc.star.as_ref().map(|s| Vec2f64 { x: s.x, y: s.y }),
    }
}

pub enum PlayerStance {
    Normal,
    Scavenge,
    Combat,
}

pub fn autofocus_priority(_loc: &Location, stance: &PlayerStance) {
    match stance {
        PlayerStance::Normal => {
            // Planets,
            // Ships,
            // Containers/Minerals
        }
        PlayerStance::Scavenge => {
            // Containers/Minerals
            // Planets
            // Ships
        }
        PlayerStance::Combat => {
            // Hostile ships
            // Friendly ships
            // Containers/minerals
            // Planets
        }
    }
}
