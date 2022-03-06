use std::mem;
use crate::GameState;
use crate::vec2::Vec2f64;
use crate::world::{lerp, Location, Planet, PlanetV2, Ship};

pub fn interpolate_states(state_a: &GameState, state_b: &GameState, value: f64) -> GameState {
    let mut result = state_a.clone();
    for i in 0..result.locations.len() {
        let res = &mut result.locations[i];
        if let Some(target) = state_b.locations.get(i) {
            interpolate_location(res, target, value);
        }
    }
    result
}

fn interpolate_location(result: &mut Location, target: &Location, value: f64) {
    let read_loc_copy = result.clone();
    for i in 0..result.ships.len() {
        let ship = &mut result.ships[i];
        if let Some(target) = target.ships.get(i) {
            interpolate_ship(ship, target, value);
        }
    }
    for i in 0..result.planets.len() {
        let planet = &mut result.planets[i];
        if let Some(target) = target.planets.get(i) {
            interpolate_planet(planet, target, value, &read_loc_copy);
        }
    }

}

fn interpolate_planet(result: &mut Planet, target: &Planet, value: f64, loc: &Location) {
    let mut res_v2 = PlanetV2::from(result, loc);
    let tar_v2 = PlanetV2::from(target, loc);
    interpolate_planet_v2(&mut res_v2, &tar_v2, value);
    mem::swap(&mut Planet::from(&res_v2), result);
}

fn interpolate_planet_v2(result: &mut PlanetV2, target: &PlanetV2, value: f64) {
    todo!()
}

fn interpolate_ship(result: &mut Ship, target: &Ship, value: f64) {
    result.x = lerp(result.x, target.x, value);
    result.y = lerp(result.y, target.y, value);
}
