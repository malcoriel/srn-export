use crate::fof;
use crate::fof::{FofActor, FriendOrFoe};
use crate::indexing::{GameStateIndexes, ObjectIndexSpecifier, ObjectSpecifier};
use crate::vec2::Vec2f64;
use crate::world::{GameState, Location, SpatialIndexes};
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

pub fn build_spatial_index(loc: &Location, loc_idx: usize) -> SpatialIndex {
    let count = loc.planets.len() + loc.ships.len() + loc.minerals.len() + loc.containers.len() + 1;
    let mut refs = Vec::with_capacity(count);
    let mut points = Vec::with_capacity(count);
    for i in 0..loc.planets.len() {
        let p = &loc.planets[i];
        refs.push(ObjectIndexSpecifier::Planet { idx: i });
        points.push((p.spatial.position.x, p.spatial.position.y));
    }
    for i in 0..loc.ships.len() {
        let ship = &loc.ships[i];
        refs.push(ObjectIndexSpecifier::Ship { idx: i });
        points.push((ship.spatial.position.x, ship.spatial.position.y));
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
    for i in 0..loc.asteroids.len() {
        let c = &loc.asteroids[i];
        refs.push(ObjectIndexSpecifier::Asteroid { idx: i });
        points.push((c.spatial.position.x, c.spatial.position.y));
    }
    for i in 0..loc.projectiles.len() {
        let c = &loc.projectiles[i];
        refs.push(ObjectIndexSpecifier::Projectile { idx: i });
        points.push((c.get_spatial().position.x, c.get_spatial().position.y));
    }
    // in case of no objects (e.g. sandbox) kdbush will crash
    points.push((0.0, 0.0));
    let index = KDBush::create(points, kdbush::DEFAULT_NODE_SIZE);
    SpatialIndex::new(loc_idx, index, refs)
}

pub const AUTOFOCUS_RADIUS: f64 = 30.0;

pub fn update_autofocus_full(state: &mut GameState, spatial_indexes: &mut SpatialIndexes) {
    for i in 0..state.locations.len() {
        let loc = &mut state.locations[i];
        let spatial_index = spatial_indexes
            .values
            .entry(i)
            .or_insert(build_spatial_index(loc, i));
        update_location_autofocus(state, i, &spatial_index)
    }
}

pub fn update_location_autofocus(state: &mut GameState, loc_idx: usize, index: &SpatialIndex) {
    let loc_clone = state.locations[loc_idx].clone();
    let loc_clone_ref = &loc_clone;
    if loc_clone_ref.planets.len()
        + loc_clone_ref.ships.len()
        + loc_clone_ref.minerals.len()
        + loc_clone_ref.containers.len()
        == 0
    {
        return;
    }
    let mut ship_mods_neutral = vec![];
    let mut ship_mods_hostile = vec![];
    for i in 0..loc_clone_ref.ships.len() {
        let current_ship = &loc_clone_ref.ships[i];
        let current_ship_fof_actor = FofActor::Object {
            spec: ObjectSpecifier::Ship {
                id: current_ship.id,
            },
        };

        let ship_pos = current_ship.spatial.position.clone();
        let around_unfiltered = index.rad_search(&ship_pos, AUTOFOCUS_RADIUS);
        let mut around_neutral = vec![];
        let mut around_hostile = vec![];

        for sp in around_unfiltered.iter() {
            match sp {
                ObjectIndexSpecifier::Ship { .. } => {
                    let should_pick_ship = {
                        if let Some(osp) = object_index_into_object_id(&sp, loc_clone_ref) {
                            fof::friend_or_foe(
                                state,
                                current_ship_fof_actor.clone(),
                                FofActor::Object { spec: osp },
                            ) == FriendOrFoe::Foe
                        } else {
                            // potentially impossible
                            false
                        }
                    };
                    if should_pick_ship {
                        around_hostile.push(sp);
                    }
                }
                _ => {
                    around_neutral.push(sp);
                }
            };
        }
        let sorter = |a, b| {
            let a_pos = object_index_into_object_pos(a, &loc_clone_ref);
            let a_dist = a_pos.map_or(f64::INFINITY, |p| p.euclidean_distance(&ship_pos));
            let b_pos = object_index_into_object_pos(b, &loc_clone_ref);
            let b_dist = b_pos.map_or(f64::INFINITY, |p| p.euclidean_distance(&ship_pos));
            if !b_dist.is_finite() || !a_dist.is_finite() {
                return Ordering::Equal;
            }
            a_dist.partial_cmp(&b_dist).unwrap()
        };
        around_neutral.sort_by(|a, b| sorter(a, b));
        around_hostile.sort_by(|a, b| sorter(a, b));
        ship_mods_neutral.push((
            around_neutral
                .get(0)
                .and_then(|ois| object_index_into_object_id(ois, &loc_clone_ref)),
            i,
        ));
        ship_mods_hostile.push((
            around_hostile
                .get(0)
                .and_then(|ois| object_index_into_object_id(ois, &loc_clone_ref)),
            i,
        ));
    }
    for (new_val, i) in ship_mods_neutral.into_iter() {
        let ship = &mut state.locations[loc_idx].ships[i];
        ship.auto_focus = new_val;
    }
    for (new_val, i) in ship_mods_hostile.into_iter() {
        let ship = &mut state.locations[loc_idx].ships[i];
        ship.hostile_auto_focus = new_val;
    }
}

pub fn object_index_into_object_id(
    ois: &ObjectIndexSpecifier,
    loc: &Location,
) -> Option<ObjectSpecifier> {
    match ois {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { idx } => loc
            .minerals
            .get(*idx)
            .map(|o| ObjectSpecifier::Mineral { id: o.id }),
        ObjectIndexSpecifier::Asteroid { idx } => loc
            .asteroids
            .get(*idx)
            .map(|o| ObjectSpecifier::Asteroid { id: o.id }),
        ObjectIndexSpecifier::Projectile { .. } => None, // projectiles do not have uuid ids, so only indexes for them
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

pub fn object_index_into_object_pos(ois: &ObjectIndexSpecifier, loc: &Location) -> Option<Vec2f64> {
    match ois {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { idx } => {
            loc.minerals.get(*idx).map(|o| Vec2f64 { x: o.x, y: o.y })
        }
        ObjectIndexSpecifier::Container { idx } => {
            loc.containers.get(*idx).map(|o| o.position.clone())
        }
        ObjectIndexSpecifier::Planet { idx } => {
            loc.planets.get(*idx).map(|o| o.spatial.position.clone())
        }
        ObjectIndexSpecifier::Ship { idx } => loc
            .ships
            .get(*idx)
            .map(|ship| ship.spatial.position.clone()),
        ObjectIndexSpecifier::Star => loc.star.as_ref().map(|o| o.spatial.position.clone()),
        ObjectIndexSpecifier::Projectile { idx } => loc
            .projectiles
            .get(*idx)
            .map(|proj| proj.get_spatial().position.clone()),
        ObjectIndexSpecifier::Asteroid { idx } => loc
            .asteroids
            .get(*idx)
            .map(|ship| ship.spatial.position.clone()),
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
