#![feature(exclusive_range_pattern)]
#![allow(dead_code)]
#![allow(warnings)]
#[cfg(target_arch = "wasm32")]
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
extern crate uuid;

pub fn new_id() -> Uuid {
    // technically, should never be needed on client as entity generation is a privileged thing
    Default::default()
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn warn(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn error(s: &str);
}

macro_rules! log {
    ($($t:tt)*) => {
        unsafe {
            (crate::log(&format_args!("wasm log: {}", $($t)*).to_string()))
            }
    }
}

macro_rules! warn {
    ($($t:tt)*) => {
        unsafe {
            (crate::warn(&format_args!("wasm warn: {}", $($t)*).to_string()))
            }
    }
}

macro_rules! err {
    ($($t:tt)*) => {
        unsafe {
            (crate::error(&format_args!("wasm err: {}"$($t)*).to_string()))
            }
    }
}

#[path = "../../server/src/world.rs"]
mod world;

#[path = "../../server/src/planet_movement.rs"]
mod planet_movement;

#[path = "../../server/src/vec2.rs"]
mod vec2;

#[path = "../../server/src/random_stuff.rs"]
mod random_stuff;

#[path = "../../server/src/system_gen.rs"]
mod system_gen;

#[path = "../../server/src/perf.rs"]
mod perf;

#[path = "../../server/src/inventory.rs"]
mod inventory;

#[path = "../../server/src/market.rs"]
mod market;

#[path = "../../server/src/dialogue_dto.rs"]
mod dialogue_dto;

#[path = "../../server/src/long_actions.rs"]
mod long_actions;

#[path = "../../server/src/locations.rs"]
mod locations;

#[path = "../../server/src/tractoring.rs"]
mod tractoring;

#[path = "../../server/src/notifications.rs"]
mod notifications;

pub const DEBUG_PHYSICS: bool = false;
pub const ENABLE_PERF: bool = false;

use serde::Deserialize as Deserializable;
use serde_derive::{Deserialize, Serialize};
use serde_json::Error;
use uuid::Uuid;

static DEFAULT_ERR: &str = "";

#[derive(Serialize)]
struct ErrJson {
    message: String,
}

pub fn fire_event(_ev: world::GameEvent) {
    // no support for events on client
}

pub fn kick_player(_p: Uuid) {
    // no support for removing players on client
}

fn extract_args<'a, T: Deserializable<'a>>(
    serialized_args: &'a str,
) -> (Result<T, Error>, Option<String>) {
    let args = serde_json::from_str::<T>(serialized_args);
    let mut return_result = None;
    if args.is_err() {
        let error = args.err().unwrap();
        return_result = Some(deserialize_err_or_def(&error));
        (Err(error), return_result)
    } else {
        (args, return_result)
    }
}

fn deserialize_err_or_def(reason: &Error) -> String {
    serde_json::to_string(&ErrJson {
        message: format!("err deserializing {}", reason.to_string()),
    })
    .unwrap_or(DEFAULT_ERR.to_string())
}

#[wasm_bindgen]
pub fn parse_state(serialized_args: &str) -> String {
    if !(cfg!(debug_assertions)) {
        return serialized_args.to_string();
    }

    let (args, return_result) = extract_args::<world::GameState>(serialized_args);
    if return_result.is_some() {
        return return_result.unwrap();
    }
    let args = args.ok().unwrap();
    return serde_json::to_string(&args).unwrap_or(DEFAULT_ERR.to_string());
}

#[derive(Deserialize)]
pub struct UpdateWorldArgs {
    state: world::GameState,
    limit_area: world::AABB,
}

#[wasm_bindgen]
pub fn update_world(serialized_args: &str, elapsed_micro: i64) -> String {
    let (args, return_result) = extract_args::<UpdateWorldArgs>(serialized_args);
    if return_result.is_some() {
        return return_result.unwrap();
    }
    let args = args.ok().unwrap();

    // log!(format!("{:?}", args.limit_area));
    let (new_state, _sampler) = world::update_world(
        args.state,
        elapsed_micro,
        true,
        perf::Sampler::new(vec![]),
        world::UpdateOptions {
            disable_hp_effects: false,
            limit_area: args.limit_area,
        },
    );
    return serde_json::to_string(&new_state).unwrap_or(DEFAULT_ERR.to_string());
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ApplyShipActionArgs {
    state: world::GameState,
    ship_action: world::ShipAction,
    player_id: Uuid,
}

// returns serialized ship
#[wasm_bindgen]
pub fn apply_ship_action(serialized_apply_args: &str) -> String {
    let (args, return_result) = extract_args::<ApplyShipActionArgs>(serialized_apply_args);
    if return_result.is_some() {
        return return_result.unwrap();
    }
    let args = args.ok().unwrap();
    let new_ship = world::apply_ship_action(args.ship_action, &args.state, args.player_id);
    return serde_json::to_string(&new_ship).unwrap_or(DEFAULT_ERR.to_string());
}
