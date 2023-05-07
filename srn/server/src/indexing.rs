use crate::autofocus::build_spatial_index;
use itertools::Itertools;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

use crate::planet_movement::{get_radial_bodies, IBodyV2};
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
            loc.ships = loc
                .ships
                .iter()
                .filter_map(|s| {
                    if s.id != ship_id {
                        Some(s.clone())
                    } else {
                        found_ship = Some(s.clone());
                        should_break = true;
                        None
                    }
                })
                .collect::<Vec<_>>();
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
        loc.ships = loc
            .ships
            .iter()
            .filter_map(|s| {
                if s.id != ship_id {
                    Some(s.clone())
                } else {
                    found_ship = Some(s.clone());
                    should_break = true;
                    None
                }
            })
            .collect::<Vec<_>>();
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

pub fn find_my_ship_index(state: &GameState, player_id: Uuid) -> Option<ShipIdx> {
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
    Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TypescriptDefinition, TypeScriptify, Hash,
)]
#[serde(tag = "tag")]
pub enum ObjectSpecifier {
    Unknown,
    Mineral { id: Uuid },
    Asteroid { id: Uuid },
    Container { id: Uuid },
    Planet { id: Uuid },
    Ship { id: Uuid },
    Star { id: Uuid },
    AsteroidBelt { id: Uuid },
    Wreck { id: Uuid },
    Location { id: Uuid },
}

pub trait Spec {
    fn spec(&self) -> ObjectSpecifier;
}

impl Spec for PlanetV2 {
    fn spec(&self) -> ObjectSpecifier {
        ObjectSpecifier::Planet { id: self.id }
    }
}

impl ObjectSpecifier {
    pub fn get_id(&self) -> Option<Uuid> {
        match self {
            ObjectSpecifier::Unknown => None,
            ObjectSpecifier::Mineral { id } => Some(*id),
            ObjectSpecifier::Container { id } => Some(*id),
            ObjectSpecifier::Planet { id } => Some(*id),
            ObjectSpecifier::Ship { id } => Some(*id),
            ObjectSpecifier::Star { id } => Some(*id),
            ObjectSpecifier::Asteroid { id } => Some(*id),
            ObjectSpecifier::AsteroidBelt { id } => Some(*id),
            ObjectSpecifier::Wreck { id } => Some(*id),
            ObjectSpecifier::Location { id } => Some(*id),
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
    Container { idx: usize },
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

    GameStateIndexes {
        planets_by_id,
        bodies_by_id,
        players_by_id,
        non_body_spatials_by_id,
        ships_by_id,
        anchor_distances,
    }
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
        ObjectSpecifier::Ship { .. } => indexes.bodies_by_id.get(&spec).map(|b| b.get_spatial()),
        ObjectSpecifier::Star { .. } => indexes.bodies_by_id.get(&spec).map(|b| b.get_spatial()),
        ObjectSpecifier::AsteroidBelt { .. } => None,
        ObjectSpecifier::Wreck { .. } => None,
        ObjectSpecifier::Location { .. } => None,
    }
}
