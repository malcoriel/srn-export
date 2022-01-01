#![feature(exclusive_range_pattern)]
#![allow(dead_code)]
#![allow(warnings)]

extern crate uuid;
use std::collections::HashMap;
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
            (crate::error(&format_args!("wasm err: {}", $($t)*).to_string()))
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

#[path = "../../server/src/substitutions.rs"]
mod substitutions;

#[path = "../../server/src/ship_action.rs"]
mod ship_action;

#[path = "../../server/src/combat.rs"]
mod combat;

#[path = "../../server/src/indexing.rs"]
mod indexing;

#[path = "../../server/src/abilities.rs"]
mod abilities;

#[path = "../../server/src/autofocus.rs"]
mod autofocus;

#[path = "../../server/src/api_struct.rs"]
mod api_struct;

#[path = "../../server/src/pirate_defence.rs"]
mod pirate_defence;

#[path = "../../server/src/cargo_rush.rs"]
mod cargo_rush;

#[path = "../../server/src/tutorial.rs"]
mod tutorial;

#[path = "../../server/src/bots.rs"]
mod bots;

#[path = "../../server/src/dialogue.rs"]
mod dialogue;

#[path = "../../server/src/world_events.rs"]
mod world_events;

use lazy_static::lazy_static;
use regex::Regex;
use serde::Deserialize as Deserializable;
use serde_derive::{Deserialize, Serialize};
use serde_json::Error;
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use uuid::*;


pub fn get_prng() -> SmallRng {
    let mut bytes = [0u8; 8];
    getrandom::getrandom(&mut bytes);
    let uint64: [u64; 1] = bytemuck::cast(bytes);
    let prng = SmallRng::seed_from_u64(uint64[0]);
    return prng;
}


pub fn new_id() -> Uuid {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).unwrap_or_else(|err| {
        panic!("could not retreive random bytes for uuid: {}", err)
    });

    crate::Builder::from_bytes(bytes)
        .set_variant(Variant::RFC4122)
        .set_version(Version::Random)
        .build()
}



static DEFAULT_ERR: &str = "";

#[derive(Serialize)]
struct ErrJson {
    message: String,
}

lazy_static! {
    // no support for substitutions
    pub static ref SUB_RE: Regex = Regex::new(r"").unwrap();
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

use crate::indexing::find_my_ship_index;
use mut_static::MutStatic;
use std::mem;
use std::ops::DerefMut;
use rand::prelude::SmallRng;
use rand::SeedableRng;
use crate::api_struct::Room;
use crate::dialogue::{DialogueTable, parse_dialogue_script_from_file};
use crate::perf::Sampler;
use crate::system_gen::seed_state;
use crate::world::GameMode;

lazy_static! {
    pub static ref global_sampler: MutStatic<perf::Sampler> = {
        let mut marks_holder = vec![];
        for mark in perf::SamplerMarks::iter() {
            marks_holder.push(mark.to_string());
        }
        MutStatic::from(perf::Sampler::new(marks_holder))
    };
}

pub struct InternalTimers {
    last_perf_flush_at_ticks: u32,
}

pub const DEBUG_PHYSICS: bool = false;
pub const ENABLE_PERF: bool = false;
const PERF_CONSUME_TIME_MS: i32 = 30 * 1000;

lazy_static! {
    pub static ref timers: MutStatic<InternalTimers> = MutStatic::from(InternalTimers {
        last_perf_flush_at_ticks: 0
    });
}

#[derive(Deserialize)]
pub struct UpdateWorldArgs {
    state: world::GameState,
    limit_area: world::AABB,
    client: Option<bool>,
}

#[wasm_bindgen]
pub fn update_world(serialized_args: &str, elapsed_micro: i64) -> String {
    let (args, return_result) = extract_args::<UpdateWorldArgs>(serialized_args);
    if return_result.is_some() {
        return return_result.unwrap();
    }
    let args = args.ok().unwrap();

    let mut indexes = world::SpatialIndexes {
        values: HashMap::new()
    };
    let (new_state, sampler) = world::update_world(
        args.state,
        elapsed_micro,
        args.client.unwrap_or(true),
        get_sampler_clone(),
        world::UpdateOptions {
            disable_hp_effects: false,
            limit_area: args.limit_area,
        },
        &mut indexes,
        &mut get_prng(),
        // these fields make sense only for full simulation, as they are part of the room now
        &mut Default::default(),
        &Default::default()
    );

    if ENABLE_PERF {
        mem::replace(global_sampler.write().unwrap().deref_mut(), sampler);

        let last_flush = {
            let guard = timers.read().unwrap();
            guard.last_perf_flush_at_ticks
        } as i32;
        let diff = (new_state.millis as i32 - last_flush).abs();
        if diff > PERF_CONSUME_TIME_MS {
            timers.write().unwrap().last_perf_flush_at_ticks = new_state.millis;
            let (sampler_out, metrics) = global_sampler.write().unwrap().clone().consume();
            mem::replace(global_sampler.write().unwrap().deref_mut(), sampler_out);
            log!(format!(
                "performance stats over {} sec \n{}",
                PERF_CONSUME_TIME_MS / 1000 / 1000,
                metrics.join("\n")
            ));
        }
    }

    return serde_json::to_string(&new_state).unwrap_or(DEFAULT_ERR.to_string());
}

fn get_sampler_clone() -> Sampler {
    if ENABLE_PERF {
        global_sampler.read().unwrap().clone()
    } else {
        perf::Sampler::new(vec![])
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ApplyShipActionArgs {
    state: world::GameState,
    ship_action: ship_action::ShipActionRust,
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
    let ship_idx = find_my_ship_index(&args.state, args.player_id);
    let new_ship = ship_action::apply_ship_action(args.ship_action, &args.state, ship_idx, true);
    return serde_json::to_string(&new_ship).unwrap_or(DEFAULT_ERR.to_string());
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct SeedWorldArgs {
    seed: String,
    mode: GameMode
}


#[wasm_bindgen]
pub fn seed_world(serialized_args: &str) -> String {
    let (args, return_result) = extract_args::<SeedWorldArgs>(serialized_args);
    if return_result.is_some() {
        return return_result.unwrap();
    }
    let args = args.ok().unwrap();
    let seeded_world = seed_state(&args.mode, args.seed);
    return serde_json::to_string(&seeded_world).unwrap_or(DEFAULT_ERR.to_string());
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CreateRoomArgs {
    mode: GameMode
}

#[wasm_bindgen]
pub fn create_room(args: JsValue) -> Result<JsValue, JsValue> {
    let args: CreateRoomArgs = serde_wasm_bindgen::from_value(args)?;
    let (_, room) = world::make_room(&args.mode, new_id());
    Ok(serde_wasm_bindgen::to_value(&room)?)
}

#[wasm_bindgen]
pub fn update_room(room: JsValue, elapsed_micro: i64, d_table: JsValue) -> Result<JsValue, JsValue> {
    let room: Room = serde_wasm_bindgen::from_value(room)?;
    let d_table: DialogueTable = serde_wasm_bindgen::from_value(d_table)?;
    let (_indexes, room, _sampler) = world::update_room(&mut get_prng(), get_sampler_clone(), elapsed_micro, &room, &d_table);
    Ok(serde_wasm_bindgen::to_value(&room)?)
}

#[wasm_bindgen]
pub fn update_room_full(room: JsValue, total_ticks: i64, d_table: JsValue, step_ticks: i64) -> Result<JsValue, JsValue> {
    let mut room: Room = serde_wasm_bindgen::from_value(room)?;
    let mut sampler = get_sampler_clone();
    let prng = &mut get_prng();
    let d_table: DialogueTable = serde_wasm_bindgen::from_value(d_table)?;
    let mut remaining = total_ticks;
    while remaining > 0 {
        remaining -= step_ticks;
        let (_indexes, _room, _sampler) = world::update_room(prng, sampler, step_ticks, &room, &d_table);
        sampler = _sampler;
        room = _room;
    }
    Ok(serde_wasm_bindgen::to_value(&room)?)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct DialogueDirContents {
    basic_planet: String,
}

#[wasm_bindgen]
pub fn make_dialogue_table(dir_contents: JsValue) -> Result<JsValue, JsValue> {
    let mut res = vec![];
    let dir_contents: DialogueDirContents = serde_wasm_bindgen::from_value(dir_contents)?;
    res.push(parse_dialogue_script_from_file("basic_planet.json", dir_contents.basic_planet));
    let mut d_table = DialogueTable::new();
    for s in res {
        d_table.scripts.insert(s.id, s);
    }
    Ok(serde_wasm_bindgen::to_value(&d_table)?)
}

