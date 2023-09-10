use crate::combat::{Health, MAX_COLLIDER_RADIUS};
use crate::fof;
use crate::fof::{FofActor, FriendOrFoe};
use crate::indexing::{
    find_my_ship, find_my_ship_mut, find_player_ship_index, find_ship_mut, GameStateIndexes,
    ObjectIndexSpecifier, ObjectSpecifier,
};
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

    // attempt to optimize search by first querying by radius + max possible radius of a collider,
    // and then filtering out smaller objects via comparing actual distance between centers
    // vs sum of radiuses
    pub fn rad_search_consider_obj_radius(
        &self,
        around: &Vec2f64,
        radius: f64,
        loc: &Location,
    ) -> Vec<ObjectIndexSpecifier> {
        self.rad_search(around, radius + MAX_COLLIDER_RADIUS)
            .into_iter()
            .filter(|ois| {
                if let Some(pos) = object_index_into_object_pos(ois, loc) {
                    if let Some(target_rad) = object_index_into_object_radius(ois, loc) {
                        if pos.euclidean_distance(around) < target_rad + radius {
                            return true;
                        }
                    }
                };
                false
            })
            .collect()
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

pub fn update_location_autofocus(
    state: &mut GameState,
    loc_idx: usize,
    index: &SpatialIndex,
    client: bool,
) {
    if !client {
        // this feature is client-only, and is only needed for the current player's ship
        // also, it's pretty expensive to run
        return;
    }

    let loc = &state.locations[loc_idx];
    if loc.planets.len() + loc.ships.len() + loc.minerals.len() + loc.containers.len() == 0 {
        return;
    }

    let mut around_neutral = vec![];
    let mut around_hostile = vec![];

    if let Some(idx) = find_player_ship_index(state, state.my_id) {
        // the location on client is always idx=0, so no need to use loc_idx
        let current_ship_fof_actor = FofActor::ObjectIdx {
            spec: ObjectIndexSpecifier::Ship { idx: idx.ship_idx },
        };
        let current_ship = &loc.ships[idx.ship_idx];
        let ship_pos = current_ship.spatial.position.clone();

        extract_closest_into(
            state,
            index,
            loc_idx,
            current_ship_fof_actor,
            &ship_pos,
            &mut around_neutral,
            &mut around_hostile,
            AUTOFOCUS_RADIUS,
        );
        let new_neutral_focus = around_neutral
            .get(0)
            .and_then(|ois| object_index_into_object_id(ois, loc));
        let new_hostile_focus = around_hostile
            .get(0)
            .and_then(|ois| object_index_into_object_id(ois, loc));

        let current_ship = &mut state.locations[loc_idx].ships[idx.ship_idx];
        current_ship.auto_focus = new_neutral_focus;
        current_ship.hostile_auto_focus = new_hostile_focus;
    }
}

pub fn extract_closest_into(
    state: &GameState,
    index: &SpatialIndex,
    loc_idx: usize,
    fof_actor: FofActor,
    actor_pos: &Vec2f64,
    around_neutral: &mut Vec<ObjectIndexSpecifier>,
    around_hostile: &mut Vec<ObjectIndexSpecifier>,
    radius: f64,
) {
    let around_unfiltered = index.rad_search(&actor_pos, radius);
    for sp in around_unfiltered.iter() {
        if match &fof_actor {
            FofActor::Player { .. } => false,
            FofActor::ObjectIdx { spec } => *spec == *sp,
        } {
            // skip itself
            continue;
        }
        if fof::friend_or_foe_idx(state, fof_actor.clone(), sp, loc_idx) == FriendOrFoe::Foe {
            around_hostile.push(sp.clone());
        } else {
            around_neutral.push(sp.clone());
        }
    }
    let sorter = |left: &&ObjectIndexSpecifier, right: &&ObjectIndexSpecifier| {
        let a_pos = object_index_into_object_pos(left, &state.locations[loc_idx]);
        let a_dist = a_pos.map_or(f64::INFINITY, |p| p.euclidean_distance(&actor_pos));
        let b_pos = object_index_into_object_pos(right, &state.locations[loc_idx]);
        let b_dist = b_pos.map_or(f64::INFINITY, |p| p.euclidean_distance(&actor_pos));
        if !b_dist.is_finite() || !a_dist.is_finite() {
            return Ordering::Equal;
        }
        a_dist.partial_cmp(&b_dist).unwrap()
    };
    around_neutral.sort_by(|a: &ObjectIndexSpecifier, b: &ObjectIndexSpecifier| sorter(&a, &b));
    around_hostile.sort_by(|a: &ObjectIndexSpecifier, b: &ObjectIndexSpecifier| sorter(&a, &b));
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
        ObjectIndexSpecifier::Projectile { idx } => loc
            .projectiles
            .get(*idx)
            .map(|o| ObjectSpecifier::Projectile { id: o.get_id() }),
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
        ObjectIndexSpecifier::Wreck { idx } => loc
            .wrecks
            .get(*idx)
            .map(|o| ObjectSpecifier::Wreck { id: o.id }),
        ObjectIndexSpecifier::Explosion { idx } => loc
            .explosions
            .get(*idx)
            .map(|e| ObjectSpecifier::Explosion { id: e.id }),
        ObjectIndexSpecifier::AsteroidBelt { idx } => loc
            .asteroid_belts
            .get(*idx)
            .map(|e| ObjectSpecifier::AsteroidBelt { id: e.id }),
    }
}

pub fn object_index_into_object_radius(ois: &ObjectIndexSpecifier, loc: &Location) -> Option<f64> {
    match ois {
        ObjectIndexSpecifier::Unknown => None,
        ObjectIndexSpecifier::Mineral { idx } => loc.minerals.get(*idx).map(|o| o.radius),
        ObjectIndexSpecifier::Asteroid { idx } => loc.asteroids.get(*idx).map(|o| o.spatial.radius),
        ObjectIndexSpecifier::Projectile { idx } => {
            loc.projectiles.get(*idx).map(|p| p.get_spatial().radius)
        }
        ObjectIndexSpecifier::Container { idx } => loc.containers.get(*idx).map(|o| o.radius),
        ObjectIndexSpecifier::Planet { idx } => loc.planets.get(*idx).map(|o| o.spatial.radius),
        ObjectIndexSpecifier::Ship { idx } => loc.ships.get(*idx).map(|o| o.spatial.radius),
        ObjectIndexSpecifier::Star => loc.star.as_ref().map(|s| s.spatial.radius),
        ObjectIndexSpecifier::Wreck { idx } => loc.wrecks.get(*idx).map(|o| o.spatial.radius),
        ObjectIndexSpecifier::Explosion { idx } => {
            loc.explosions.get(*idx).map(|p| p.spatial.radius)
        }
        ObjectIndexSpecifier::AsteroidBelt { idx } => {
            loc.asteroid_belts.get(*idx).map(|ab| ab.spatial.radius)
        }
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
        ObjectIndexSpecifier::Asteroid { idx } => {
            loc.asteroids.get(*idx).map(|a| a.spatial.position.clone())
        }
        ObjectIndexSpecifier::Wreck { idx } => {
            loc.wrecks.get(*idx).map(|wr| wr.spatial.position.clone())
        }
        ObjectIndexSpecifier::Explosion { idx } => {
            loc.explosions.get(*idx).map(|e| e.spatial.position.clone())
        }
        ObjectIndexSpecifier::AsteroidBelt { idx } => loc
            .asteroid_belts
            .get(*idx)
            .map(|a| a.spatial.position.clone()),
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
