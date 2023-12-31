use crate::autofocus::build_spatial_index;
use itertools::Itertools;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::{Display, Formatter, Write};
use strum::AsStaticRef;
use strum::AsStaticStr;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

use crate::planet_movement::{get_radial_bodies, IBodyV2};
use crate::properties::{ObjectProperty, ObjectPropertyKey};
use crate::world::{
    Asteroid, Container, GameState, Location, NatSpawnMineral, PlanetV2, Player, Ship, ShipIdx,
    SpatialIndexes, SpatialProps,
};
use crate::{world, Vec2f64};

pub fn find_mineral(loc: &world::Location, id: Uuid) -> Option<&NatSpawnMineral> {
    loc.minerals.iter().find(|m| m.id == id)
}

pub fn find_container(loc: &world::Location, id: Uuid) -> Option<&Container> {
    loc.containers.iter().find(|m| m.id == id)
}

pub fn find_asteroid(loc: &world::Location, id: Uuid) -> Option<&Asteroid> {
    loc.asteroids.iter().find(|m| m.id == id)
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

pub fn index_players_by_ship_id(players: &Vec<Player>) -> HashMap<Uuid, &Player> {
    let mut by_id = HashMap::new();
    for p in players.iter() {
        if let Some(ship_id) = p.ship_id {
            by_id.entry(ship_id).or_insert(p);
        }
    }
    by_id
}

pub fn index_all_ships_by_id(locations: &Vec<Location>) -> HashMap<Uuid, &Ship> {
    let mut by_id = HashMap::new();
    for loc in locations.iter() {
        for p in loc.ships.iter() {
            by_id.entry(p.id).or_insert(p);
        }
    }
    by_id
}

pub fn index_ships_by_id(loc: &Location) -> HashMap<Uuid, &Ship> {
    let mut by_id = HashMap::new();
    for p in loc.ships.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

pub fn index_planets_by_id(planets: &Vec<PlanetV2>) -> HashMap<Uuid, &PlanetV2> {
    let mut by_id = HashMap::new();
    for p in planets.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

pub fn index_all_planets_by_id(locations: &Vec<Location>) -> HashMap<Uuid, &PlanetV2> {
    let mut by_id = HashMap::new();
    for loc in locations.iter() {
        for p in loc.planets.iter() {
            by_id.entry(p.id).or_insert(p);
        }
    }
    by_id
}

pub fn index_players_by_id(players: &Vec<Player>) -> HashMap<Uuid, &Player> {
    let mut by_id = HashMap::new();
    for p in players.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

pub fn index_players_by_ship_id_mut(players: &mut Vec<Player>) -> HashMap<Uuid, &mut Player> {
    let mut by_id = HashMap::new();
    for p in players.iter_mut() {
        if let Some(ship_id) = p.ship_id {
            by_id.entry(ship_id).or_insert(p);
        }
    }
    by_id
}

pub fn find_and_extract_ship(state: &mut GameState, player_id: Uuid) -> Option<Ship> {
    let player = find_my_player(state, player_id);
    if player.is_none() {
        return None;
    }
    let mut found_ship = None;
    if let Some(ship_id) = player.unwrap().ship_id {
        let mut should_break = false;
        for loc in state.locations.iter_mut() {
            for s in loc.ships.iter_mut() {
                if s.id == ship_id {
                    found_ship = Some(s.clone());
                    should_break = true;
                    s.to_clean = true;
                }
            }
            if should_break {
                break;
            }
        }
    }
    return found_ship;
}

pub fn find_and_extract_ship_by_id(state: &mut GameState, ship_id: Uuid) -> Option<Ship> {
    let mut found_ship = None;
    let mut should_break = false;
    for loc in state.locations.iter_mut() {
        for s in loc.ships.iter_mut() {
            if s.id == ship_id {
                found_ship = Some(s.clone());
                should_break = true;
                s.to_clean = true;
            }
        }
        if should_break {
            break;
        }
    }

    return found_ship;
}

pub fn find_my_ship(state: &GameState, player_id: Uuid) -> Option<&Ship> {
    let player = find_my_player(state, player_id);
    if player.is_none() {
        return None;
    }
    if let Some(ship_id) = player.unwrap().ship_id {
        for loc in state.locations.iter() {
            if let Some(ship) = loc.ships.iter().find(|s| s.id == ship_id) {
                return Some(ship);
            }
        }
    }
    return None;
}

pub fn find_ship_mut(state: &mut GameState, ship_id: Uuid) -> Option<&mut Ship> {
    for loc in state.locations.iter_mut() {
        if let Some(ship) = loc.ships.iter_mut().find(|s| s.id == ship_id) {
            return Some(ship);
        }
    }
    return None;
}

pub fn find_my_ship_mut(state: &mut GameState, player_id: Uuid) -> Option<&mut Ship> {
    let player = find_my_player(state, player_id);
    if player.is_none() {
        return None;
    }
    if let Some(ship_id) = player.unwrap().ship_id {
        for loc in state.locations.iter_mut() {
            if let Some(ship) = loc.ships.iter_mut().find(|s| s.id == ship_id) {
                return Some(ship);
            }
        }
    }
    return None;
}

pub fn find_player_ship_index(state: &GameState, player_id: Uuid) -> Option<ShipIdx> {
    let player = find_my_player(state, player_id);
    let mut idx = ShipIdx {
        location_idx: 0,
        ship_idx: 0,
    };
    let mut found = false;
    if let Some(player) = player {
        if let Some(ship_id) = player.ship_id {
            for loc in state.locations.iter() {
                idx.ship_idx = 0;
                for ship in loc.ships.iter() {
                    if ship.id == ship_id {
                        found = true;
                        break;
                    }
                    idx.ship_idx += 1;
                }
                if found {
                    break;
                }
                idx.location_idx += 1;
            }
        }
    }
    return if found { Some(idx) } else { None };
}

pub fn find_ship_index(state: &GameState, ship_id: Uuid) -> Option<ShipIdx> {
    let mut idx = ShipIdx {
        location_idx: 0,
        ship_idx: 0,
    };
    let mut found = false;

    for loc in state.locations.iter() {
        idx.ship_idx = 0;
        for ship in loc.ships.iter() {
            if ship.id == ship_id {
                found = true;
                break;
            }
            idx.ship_idx += 1;
        }
        if found {
            break;
        }
        idx.location_idx += 1;
    }
    return if found { Some(idx) } else { None };
}

pub fn find_player_by_ship_id(state: &GameState, ship_id: Uuid) -> Option<&Player> {
    for player in state.players.iter() {
        if player.ship_id.map_or(false, |sid| sid == ship_id) {
            return Some(&player);
        }
    }
    return None;
}

pub fn find_player_idx_by_ship_id(state: &GameState, ship_id: Uuid) -> Option<usize> {
    for i in 0..state.players.len() {
        if state.players[i].ship_id.map_or(false, |sid| sid == ship_id) {
            return Some(i);
        }
    }
    return None;
}

pub fn find_planet<'a, 'b>(state: &'a GameState, planet_id: &'b Uuid) -> Option<&'a PlanetV2> {
    for loc in state.locations.iter() {
        if let Some(planet) = loc.planets.iter().find(|p| p.id == *planet_id) {
            return Some(planet);
        }
    }
    return None;
}

pub fn find_planet_mut<'a, 'b>(
    state: &'a mut GameState,
    planet_id: &'b Uuid,
) -> Option<&'a mut PlanetV2> {
    for loc in state.locations.iter_mut() {
        if let Some(planet) = loc.planets.iter_mut().find(|p| p.id == *planet_id) {
            return Some(planet);
        }
    }
    return None;
}

pub fn find_my_player(state: &GameState, player_id: Uuid) -> Option<&Player> {
    state.players.iter().find(|p| p.id == player_id)
}

pub fn find_player_idx(state: &GameState, player_id: Uuid) -> Option<usize> {
    for i in 0..state.players.len() {
        if state.players[i].id == player_id {
            return Some(i);
        }
    }
    return None;
}

pub fn find_my_player_mut(state: &mut GameState, player_id: Uuid) -> Option<&mut Player> {
    let index = state
        .players
        .iter()
        .position(|player| player.id == player_id);
    if let Some(index) = index {
        let val: Option<&mut Player> = Some(&mut state.players[index]);
        return val;
    }
    return None;
}

pub fn find_player_and_ship_mut(
    state: &mut GameState,
    player_id: Uuid,
) -> (Option<&mut Player>, Option<&mut Ship>) {
    let player_idx = state
        .players
        .iter()
        .position(|player| player.id == player_id);
    let mut player = None;
    let mut ship = None;
    if let Some(player_idx) = player_idx {
        let found_player = &mut state.players[player_idx];
        if let Some(ship_id) = found_player.ship_id {
            let mut ship_idx = 0;
            let mut loc_idx = 0;
            let mut found = false;
            for loc in state.locations.iter() {
                if let Some(idx) = loc.ships.iter().position(|ship| ship.id == ship_id) {
                    ship_idx = idx;
                    found = true;
                    break;
                }
                loc_idx += 1;
            }
            if found {
                ship = Some(&mut state.locations[loc_idx].ships[ship_idx]);
            } else {
                ship = None;
            }
        }
        player = Some(found_player);
    }
    return (player, ship);
}

pub fn find_player_and_ship(
    state: &GameState,
    player_id: Uuid,
) -> (Option<&Player>, Option<&Ship>) {
    let player_idx = state
        .players
        .iter()
        .position(|player| player.id == player_id);
    let mut player = None;
    let mut ship = None;
    if let Some(player_idx) = player_idx {
        let found_player = &state.players[player_idx];
        if let Some(ship_id) = found_player.ship_id {
            let mut ship_idx = 0;
            let mut loc_idx = 0;
            let mut found = false;
            for loc in state.locations.iter() {
                if let Some(idx) = loc.ships.iter().position(|ship| ship.id == ship_id) {
                    ship_idx = idx;
                    found = true;
                    break;
                }
                loc_idx += 1;
            }
            if found {
                ship = Some(&state.locations[loc_idx].ships[ship_idx]);
            } else {
                ship = None;
            }
        }
        player = Some(found_player);
    }
    return (player, ship);
}

#[derive(
    Serialize,
    Deserialize,
    Debug,
    Clone,
    PartialEq,
    Eq,
    TypescriptDefinition,
    TypeScriptify,
    Hash,
    AsStaticStr,
)]
#[serde(tag = "tag")]
pub enum ObjectSpecifier {
    Unknown,
    Mineral { id: Uuid },
    Asteroid { id: Uuid },
    Projectile { id: i32 },
    Explosion { id: i32 },
    Container { id: Uuid },
    Planet { id: Uuid },
    Ship { id: Uuid },
    Star { id: Uuid },
    AsteroidBelt { id: Uuid },
    Wreck { id: Uuid },
    Location { id: Uuid },
}

impl Default for ObjectSpecifier {
    fn default() -> Self {
        ObjectSpecifier::Unknown
    }
}
pub trait Spec {
    fn spec(&self) -> ObjectSpecifier;
}

impl Spec for PlanetV2 {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::Planet { id: self.id }
    }
}

pub enum IdKind {
    Uuid(Uuid),
    Int(i32),
}

impl Display for IdKind {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(
            format!(
                "{}",
                match self {
                    IdKind::Uuid(id) => id.to_string(),
                    IdKind::Int(id) => id.to_string(),
                }
            )
            .as_str(),
        )
    }
}

impl IdKind {
    pub fn unwrap_uuid(self) -> Uuid {
        match self {
            IdKind::Uuid(v) => v,
            IdKind::Int(_) => panic!("Attempt to unwrap non-uuid id kind"),
        }
    }

    pub fn unwrap_int(self) -> i32 {
        match self {
            IdKind::Uuid(_) => panic!("Attempt to unwrap non-int id kind"),
            IdKind::Int(v) => v,
        }
    }
}

impl Display for ObjectSpecifier {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(
            format!(
                "{}:{}",
                self.as_static(),
                self.get_id().map_or("?".to_string(), |i| i.to_string())
            )
            .as_str(),
        )
    }
}

impl ObjectSpecifier {
    pub fn get_id(&self) -> Option<IdKind> {
        match self {
            ObjectSpecifier::Unknown => None,
            ObjectSpecifier::Mineral { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Container { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Planet { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Ship { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Star { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Asteroid { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::AsteroidBelt { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Wreck { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Location { id } => Some(IdKind::Uuid(*id)),
            ObjectSpecifier::Projectile { id } => Some(IdKind::Int(*id)),
            ObjectSpecifier::Explosion { id } => Some(IdKind::Int(*id)),
        }
    }
}

#[derive(
    Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TypescriptDefinition, TypeScriptify, Hash,
)]
#[serde(tag = "tag")]
pub enum ObjectIndexSpecifier {
    Unknown,
    Mineral { idx: usize },
    Wreck { idx: usize },
    Container { idx: usize },
    Projectile { idx: usize },
    Explosion { idx: usize },
    Asteroid { idx: usize },
    AsteroidBelt { idx: usize },
    Planet { idx: usize },
    Ship { idx: usize },
    Star,
}

#[derive(
    Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TypescriptDefinition, TypeScriptify, Hash,
)]
pub struct FullObjectIndexSpecifier {
    pub loc_idx: usize,
    pub obj_idx: ObjectIndexSpecifier,
}

#[derive(
    Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TypescriptDefinition, TypeScriptify, Hash,
)]
pub struct FullObjectSpecifier {
    pub loc_idx: usize,
    pub obj_spec: ObjectSpecifier,
}

#[derive(Clone)]
pub struct GameStateIndexes<'a> {
    pub planets_by_id: HashMap<Uuid, &'a PlanetV2>,
    pub players_by_id: HashMap<Uuid, &'a Player>,
    pub non_body_spatials_by_id: HashMap<ObjectSpecifier, &'a SpatialProps>,
    pub ships_by_id: HashMap<Uuid, &'a Ship>,
    pub anchor_distances: HashMap<ObjectSpecifier, f64>,
    pub bodies_by_id: HashMap<ObjectSpecifier, Box<&'a dyn IBodyV2>>,
    pub objects_by_property_type: Vec<HashMap<ObjectPropertyKey, Vec<ObjectIndexSpecifier>>>,
    pub reverse_id_index: HashMap<ObjectSpecifier, ObjectIndexSpecifier>,
}

impl<'a> GameStateIndexes<'a> {
    // assumes 'pushed to the last item in the array of location
    pub fn handle_explosion_added(&mut self, _loc_idx: usize, loc: &Location) {
        let added = loc
            .explosions
            .last()
            .expect("handle_explosion_added was called without adding explosion");
        self.reverse_id_index.insert(
            ObjectSpecifier::Explosion { id: added.id },
            ObjectIndexSpecifier::Explosion {
                idx: loc.explosions.len() - 1,
            },
        );
        // There may be more re-indexing of explosion if it's needed during update cycle.
        // Otherwise, everything will be re-indexed normally during the next update start
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameStateCaches {
    pub rel_orbit_cache: HashMap<u64, Vec<Vec2f64>>,
    pub rotation_cache: HashMap<u64, Vec<f64>>,
}

impl GameStateCaches {
    pub fn new() -> GameStateCaches {
        Self {
            rel_orbit_cache: Default::default(),
            rotation_cache: Default::default(),
        }
    }
}

pub fn index_state(state: &GameState) -> GameStateIndexes {
    let planets_by_id = index_all_planets_by_id(&state.locations);
    let mut bodies_by_id: HashMap<ObjectSpecifier, Box<&dyn IBodyV2>> = planets_by_id
        .iter()
        .map(|(k, v)| {
            (
                ObjectSpecifier::Planet { id: *k },
                Box::new((*v) as &dyn IBodyV2),
            )
        })
        .collect();
    let mut non_body_spatials_by_id = HashMap::new();
    for loc in state.locations.iter() {
        if let Some(star) = &loc.star {
            bodies_by_id.insert(
                ObjectSpecifier::Star { id: star.id },
                Box::new(star as &dyn IBodyV2),
            );
        }
        for asteroid in loc.asteroids.iter() {
            non_body_spatials_by_id.insert(
                ObjectSpecifier::Asteroid { id: asteroid.id },
                &asteroid.spatial,
            );
        }
    }

    let players_by_id = index_players_by_id(&state.players);
    let ships_by_id = index_all_ships_by_id(&state.locations);
    let anchor_distances = index_anchor_distances(&state.locations, &bodies_by_id);
    let objects_by_property_type = index_objects_by_property_type(&state.locations);
    let reverse_id_index = index_reverse_id(&state.locations);

    GameStateIndexes {
        planets_by_id,
        bodies_by_id,
        players_by_id,
        non_body_spatials_by_id,
        ships_by_id,
        anchor_distances,
        objects_by_property_type,
        reverse_id_index,
    }
}

fn index_reverse_id(locations: &Vec<Location>) -> HashMap<ObjectSpecifier, ObjectIndexSpecifier> {
    let mut res = HashMap::new();
    for loc in locations {
        for item in loc.ships.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Ship { id: item.1.id },
                ObjectIndexSpecifier::Ship { idx: item.0 },
            );
        }
        for item in loc.projectiles.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Projectile {
                    id: item.1.get_id(),
                },
                ObjectIndexSpecifier::Projectile { idx: item.0 },
            );
        }
        for item in loc.explosions.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Explosion { id: item.1.id },
                ObjectIndexSpecifier::Explosion { idx: item.0 },
            );
        }
        for item in loc.asteroids.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Asteroid { id: item.1.id },
                ObjectIndexSpecifier::Asteroid { idx: item.0 },
            );
        }
        for item in loc.containers.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Container { id: item.1.id },
                ObjectIndexSpecifier::Container { idx: item.0 },
            );
        }
        for item in loc.wrecks.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Wreck { id: item.1.id },
                ObjectIndexSpecifier::Wreck { idx: item.0 },
            );
        }
        for item in loc.minerals.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Mineral { id: item.1.id },
                ObjectIndexSpecifier::Mineral { idx: item.0 },
            );
        }
        for item in loc.planets.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Planet { id: item.1.id },
                ObjectIndexSpecifier::Planet { idx: item.0 },
            );
        }
        for item in loc.star.iter().enumerate() {
            res.insert(
                ObjectSpecifier::Star { id: item.1.id },
                ObjectIndexSpecifier::Star,
            );
        }
        for item in loc.asteroid_belts.iter().enumerate() {
            res.insert(
                ObjectSpecifier::AsteroidBelt { id: item.1.id },
                ObjectIndexSpecifier::AsteroidBelt { idx: item.0 },
            );
        }
    }
    return res;
}

fn index_objects_by_property_type(
    locs: &Vec<Location>,
) -> Vec<HashMap<ObjectPropertyKey, Vec<ObjectIndexSpecifier>>> {
    let mut all_loc_res = vec![];
    for loc in locs {
        let mut res = HashMap::new();
        for (proj_idx, proj) in loc.projectiles.iter().enumerate() {
            for prop in proj.get_properties().iter() {
                let entry = res.entry(prop.key()).or_insert(Vec::new());
                entry.push(ObjectIndexSpecifier::Projectile { idx: proj_idx })
            }
        }
        for (idx, wreck) in loc.wrecks.iter().enumerate() {
            for prop in wreck.properties.iter() {
                let entry = res.entry(prop.key()).or_insert(Vec::new());
                entry.push(ObjectIndexSpecifier::Wreck { idx })
            }
        }
        all_loc_res.push(res);
    }
    all_loc_res
}

fn index_anchor_distances(
    locations: &Vec<Location>,
    bodies_by_id: &HashMap<ObjectSpecifier, Box<&dyn IBodyV2>>,
) -> HashMap<ObjectSpecifier, f64> {
    let mut res = HashMap::new();
    for loc in locations {
        for body in get_radial_bodies(&loc)
            .iter()
            .sorted_by_key(|i| i.get_anchor_tier())
        {
            if let Some(anchor) = bodies_by_id.get(&body.get_movement().get_anchor_spec()) {
                let anchor_pos = &anchor.get_spatial().position;
                res.insert(
                    body.spec(),
                    body.get_spatial().position.euclidean_distance(anchor_pos),
                );
            }
        }
    }
    res
}

pub fn find_player_location_idx(state: &GameState, player_id: Uuid) -> Option<i32> {
    let player = find_my_player(state, player_id);
    if player.is_none() {
        return None;
    }
    let player = player.unwrap();
    if player.ship_id.is_none() {
        return None;
    }
    let ship_id = player.ship_id.unwrap();
    let mut idx = -1;
    let mut found = false;
    for loc in state.locations.iter() {
        idx += 1;
        for ship in loc.ships.iter() {
            if ship.id == ship_id {
                found = true;
                break;
            }
        }
        if found {
            break;
        }
    }
    return if !found { None } else { Some(idx) };
}

pub fn build_full_spatial_indexes(state: &GameState) -> SpatialIndexes {
    let mut values = HashMap::new();
    for i in 0..state.locations.len() {
        let loc = &state.locations[i];
        values.insert(i, build_spatial_index(loc, i));
    }
    SpatialIndexes { values }
}

pub fn find_spatial_ref_by_spec<'a>(
    indexes: &'a GameStateIndexes,
    spec: ObjectSpecifier,
) -> Option<&'a SpatialProps> {
    match &spec {
        ObjectSpecifier::Unknown => None,
        ObjectSpecifier::Mineral { .. } => None,
        ObjectSpecifier::Asteroid { .. } => indexes.non_body_spatials_by_id.get(&spec).map(|b| *b),
        ObjectSpecifier::Container { .. } => None,
        ObjectSpecifier::Planet { .. } => indexes.bodies_by_id.get(&spec).map(|b| b.get_spatial()),
        ObjectSpecifier::Ship { .. } => indexes
            .ships_by_id
            .get(&spec.get_id().unwrap().unwrap_uuid())
            .map(|b| &b.spatial),
        ObjectSpecifier::Star { .. } => indexes.bodies_by_id.get(&spec).map(|b| b.get_spatial()),
        ObjectSpecifier::AsteroidBelt { .. } => None,
        ObjectSpecifier::Wreck { .. } => None,
        ObjectSpecifier::Location { .. } => None,
        ObjectSpecifier::Projectile { .. } => None,
        ObjectSpecifier::Explosion { .. } => None,
    }
}

pub fn find_owning_player(
    state: &GameState,
    loc_idx: usize,
    spec: &ObjectIndexSpecifier,
) -> Option<Uuid> {
    match spec {
        ObjectIndexSpecifier::Ship { idx } => {
            let ship_id = state.locations[loc_idx].ships[*idx].id;
            let player = state
                .players
                .iter()
                .find(|p| p.ship_id.map_or(false, |sid| sid == ship_id))
                .map(|p| p.id);
            return player;
        }
        _ => None,
    }
}
