use crate::GameState;
use crate::world::{lerp, Location, Ship};

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
    for i in 0..result.ships.len() {
        let ship = &mut result.ships[i];
        if let Some(target) = target.ships.get(i) {
            interpolate_ship(ship, target, value);
        }
    }
}

fn interpolate_ship(result: &mut Ship, target: &Ship, value: f64) {
    result.x = lerp(result.x, target.x, value);
    result.y = lerp(result.y, target.y, value);
}
