use std::collections::HashMap;

use uuid::Uuid;

use crate::world;
use crate::world::{
    Container, GameState, Location, NatSpawnMineral, Planet, Player, Ship, ShipIdx,
};

pub fn find_mineral(loc: &world::Location, id: Uuid) -> Option<&NatSpawnMineral> {
    loc.minerals.iter().find(|m| m.id == id)
}

pub fn find_container(loc: &world::Location, id: Uuid) -> Option<&Container> {
    loc.containers.iter().find(|m| m.id == id)
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

pub fn index_planets_by_id(planets: &Vec<Planet>) -> HashMap<Uuid, &Planet> {
    let mut by_id = HashMap::new();
    for p in planets.iter() {
        by_id.entry(p.id).or_insert(p);
    }
    by_id
}

pub fn index_all_planets_by_id(locations: &Vec<Location>) -> HashMap<Uuid, &Planet> {
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

pub fn index_ships_by_id(ships: &Vec<Ship>) -> HashMap<Uuid, &Ship> {
    let mut by_id = HashMap::new();
    for p in ships.iter() {
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

pub fn find_planet<'a, 'b>(state: &'a GameState, planet_id: &'b Uuid) -> Option<&'a Planet> {
    for loc in state.locations.iter() {
        if let Some(planet) = loc.planets.iter().find(|p| p.id == *planet_id) {
            return Some(planet);
        }
    }
    return None;
}

pub fn find_my_player(state: &GameState, player_id: Uuid) -> Option<&Player> {
    state.players.iter().find(|p| p.id == player_id)
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
