#![allow(warnings)]
mod utils;

use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

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
    let default = String::from("");
    serde_json::from_str::<game::GameState>(serialized_state)
        .ok()
        .map(|mut state| {
            state.planets = world::update_planets(&state.planets, elapsed_micro);
            state
        })
        .map(|state| {
            serde_json::to_string(&state)
                .ok()
                .unwrap_or(default.clone())
        })
        .unwrap_or(default)
}
