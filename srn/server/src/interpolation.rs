use crate::planet_movement::IBody;
use crate::vec2::Vec2f64;
use crate::world::{lerp, Location, MovementDefinition, Planet, PlanetV2, Ship};
use crate::GameState;
use std::mem;

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
    let anchor = tar_v2.get_anchor_ref(loc);
    interpolate_planet_v2(&mut res_v2, &tar_v2, value, anchor);
    mem::swap(&mut Planet::from(&res_v2), result);
}

fn interpolate_planet_v2(
    result: &mut PlanetV2,
    target: &PlanetV2,
    value: f64,
    anchor: Box<&dyn IBody>,
) {
    let phase_table = get_rel_position_phase_table(result.movement.as_ref());
    let result_idx = result
        .transform
        .hint
        .expect("no phase table hint for transform");
    let target_idx = target
        .transform
        .hint
        .expect("no phase table hint for transform");
    let lerped_idx = lerp_usize(result_idx, target_idx, value);
    result.transform.position = phase_table[lerped_idx].add(&anchor.get_position());
}

fn lerp_usize(from: usize, to: usize, value: f64) -> usize {
    let double_val = lerp(from as f64, to as f64, value);
    double_val as usize
}

// this assumes that table is always sorted and is circular-positioned
fn find_closest_phase_index(from: Vec2f64, table: &Vec<Vec2f64>) -> usize {
    todo!()
}

fn get_rel_position_phase_table(p0: &MovementDefinition) -> Vec<Vecf264> {
    todo!()
}

fn interpolate_ship(result: &mut Ship, target: &Ship, value: f64) {
    result.x = lerp(result.x, target.x, value);
    result.y = lerp(result.y, target.y, value);
}
