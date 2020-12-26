#![allow(warnings)]
mod utils;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, world!");
}
#[path = "../../server/src/game.rs"]
mod game;
#[path = "../../server/src/world.rs"]
mod world;

#[path = "../../server/src/vec2.rs"]
mod vec2;

pub const DEBUG_PHYSICS: bool = false;

#[wasm_bindgen]
pub fn dumb(inp: u32) -> u32 {
    inp + 1
}

#[wasm_bindgen]
pub fn update(serialized_state: &str, elapsed_micro: i64) -> String {
    let mut state = serde_json::from_str::<game::GameState>(serialized_state)
        .ok()
        .unwrap();
    state.planets = world::update_planets(&state.planets, elapsed_micro);
    serde_json::to_string(&state).ok().unwrap()
}
