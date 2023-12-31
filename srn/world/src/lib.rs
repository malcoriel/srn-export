#![feature(exclusive_range_pattern)]
#![feature(format_args_capture)]
#![feature(extern_types)]
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

    #[no_mangle]
    #[used]
    static performance: web_sys::Performance;

    #[no_mangle]
    #[used]
    static process: node_sys::Process;
}

macro_rules! log {
    ($($t:tt)*) => {
        unsafe {
            (crate::log(&format_args!("wasm log: {}", $($t)*).to_string()))
            }
    }
}

macro_rules! log2 {
    ($($arg:tt)*) => {
        unsafe {
            crate::log(&format!("wasm log: {}", format_args!($($arg)*)));
        }
    }
}

macro_rules! warn2 {
    ($($arg:tt)*) => {
        unsafe {
            crate::warn(&format!("wasm log: {}", format_args!($($arg)*)));
        }
    }
}

macro_rules! err2 {
    ($($arg:tt)*) => {
        unsafe {
            crate::error(&format!("wasm log: {}", format_args!($($arg)*)));
        }
    }
}

macro_rules! warn {
    ($($t:tt)*) => {
        unsafe {
            (crate::log(&format_args!("wasm warn: {}", $($t)*).to_string()))
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

#[macro_use]
#[path = "../../server/src/macros.rs"]
mod macros;

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

#[path = "../../server/src/properties/mod.rs"]
mod properties;

#[path = "../../server/src/tutorial.rs"]
mod tutorial;

#[path = "../../server/src/bots.rs"]
mod bots;

#[path = "../../server/src/fof.rs"]
mod fof;

#[path = "../../server/src/dialogue.rs"]
mod dialogue;

#[path = "../../server/src/world_events.rs"]
mod world_events;

#[path = "../../server/src/world_actions.rs"]
mod world_actions;

#[path = "../../server/src/replay.rs"]
mod replay;

#[path = "../../server/src/interpolation.rs"]
mod interpolation;

#[path = "../../server/src/trajectory.rs"]
mod trajectory;

#[path = "../../server/src/sandbox.rs"]
mod sandbox;

#[path = "../../server/src/self_inspect.rs"]
mod self_inspect;

#[path = "../../server/src/spatial_movement.rs"]
mod spatial_movement;

#[path = "../../server/src/hp.rs"]
mod hp;

#[path = "../../server/src/effects.rs"]
mod effects;

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_derive::{Deserialize as derive_deserialize, Serialize as derive_serialize};
use serde_json::Error;
use serde_wasm_bindgen::*;
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use uuid::*;
use vec2::Vec2f64;

pub fn get_prng() -> Pcg64Mcg {
    let mut bytes = [0u8; 8];
    getrandom::getrandom(&mut bytes);
    let uint64: [u64; 1] = bytemuck::cast(bytes);
    let prng = Pcg64Mcg::seed_from_u64(uint64[0]);
    return prng;
}

pub fn seed_prng(seed: String) -> Pcg64Mcg {
    return Pcg64Mcg::seed_from_u64(system_gen::str_to_hash(seed));
}

lazy_static! {
    pub static ref SEED: String = String::from("");
}

pub fn new_id() -> Uuid {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes)
        .unwrap_or_else(|err| panic!("could not retrieve random bytes for uuid: {}", err));

    crate::Builder::from_bytes(bytes)
        .set_variant(Variant::RFC4122)
        .set_version(Version::Random)
        .build()
}

pub fn prng_id(rng: &mut Pcg64Mcg) -> Uuid {
    let mut bytes = [0u8; 16];
    rng.fill_bytes(&mut bytes);

    crate::Builder::from_bytes(bytes)
        .set_variant(Variant::RFC4122)
        .set_version(Version::Random)
        .build()
}

static DEFAULT_ERR: &str = "";

#[derive(derive_serialize)]
struct ErrJson {
    message: String,
}

lazy_static! {
    pub static ref SUB_RE: Regex = Regex::new(r"s_\w+").unwrap();
}

pub fn fire_event(_ev: world_events::GameEvent) {
    // no support for events on client
}

pub fn kick_player(_p: Uuid) {
    // no support for removing players on client
}

fn extract_args<'a, T: Deserialize<'a>>(
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

use crate::api_struct::Room;
use crate::dialogue::{parse_dialogue_script_from_file, Dialogue, DialogueTable};
use crate::indexing::{find_player_ship_index, GameStateCaches, ObjectSpecifier};
use crate::perf::{ConsumeOptions, Sampler, SamplerMarks};
use crate::system_gen::{seed_state, GenStateOpts};
use crate::world::{GameMode, GameState, SpatialProps, UpdateOptions, UpdateOptionsV2, AABB};
use chrono::Timelike;
use mut_static::MutStatic;
use rand::prelude::*;
use rand_pcg::{Mcg128Xsl64, Pcg64Mcg};
use std::any::Any;
use std::ops::DerefMut;
use std::{env, mem};

pub fn get_now_nano() -> u64 {
    get_nanos_web() as u64
}

lazy_static! {
    pub static ref global_sampler: MutStatic<perf::Sampler> = {
        let mut marks_holder = vec![];
        for mark in perf::SamplerMarks::iter() {
            marks_holder.push(mark.to_string());
        }
        let mut sampler = perf::Sampler::new(marks_holder);
        MutStatic::from(sampler)
    };
}

lazy_static! {
    pub static ref current_replay: MutStatic<Option<ReplayDiffed>> = { MutStatic::from(None) };
}

lazy_static! {
    pub static ref cached_states: MutStatic<HashMap<String, GameState>> =
        { MutStatic::from(HashMap::new()) };
}

lazy_static! {
    pub static ref current_d_table: MutStatic<Option<DialogueTable>> = { MutStatic::from(None) };
}

lazy_static! {
    pub static ref game_state_caches: MutStatic<GameStateCaches> =
        { MutStatic::from(GameStateCaches::new()) };
}

pub struct InternalTimers {
    last_perf_flush_at_ticks: u32,
}

lazy_static! {
    pub static ref ENABLE_PERF_HACK_INIT: MutStatic<bool> = { MutStatic::from(false) };
}

pub const DEBUG_PHYSICS: bool = false;
lazy_static! {
    pub static ref ENABLE_PERF: bool = { *ENABLE_PERF_HACK_INIT.read().unwrap() };
}

const PERF_CONSUME_TIME_MS: i32 = 30 * 1000;

lazy_static! {
    pub static ref timers: MutStatic<InternalTimers> = MutStatic::from(InternalTimers {
        last_perf_flush_at_ticks: 0
    });
}

#[derive(Clone, Debug, derive_deserialize, derive_serialize)]
pub struct UpdateWorldArgs {
    state: GameState,
    limit_area: AABB,
    client: Option<bool>,
    force_non_determinism: Option<bool>,
    state_tag: Option<String>,
}

#[derive(Clone, Debug, derive_deserialize, derive_serialize)]
pub struct UpdateWorldIncrementalArgs {
    state_tag: String,
    limit_area: AABB,
    client: Option<bool>,
    force_non_determinism: Option<bool>,
}

use crate::fof::FofActor;
use wasm_bindgen::{JsCast, JsObject};

fn print_type_of<T>(_: &T) {
    log!(format!("{}", std::any::type_name::<T>()))
}

#[wasm_bindgen]
pub fn get_nanos_node() -> f64 {
    let hrtime = unsafe { process.hr_time() };
    let val = hrtime.call0(&JsValue::NULL).unwrap();
    let arr = js_sys::Uint32Array::new(&val);
    let vec = arr.to_vec();
    return vec[0] as f64 * 1000.0 * 1000.0 + vec[1] as f64 / 1000.0;
}

#[wasm_bindgen]
pub fn get_nanos_web() -> f64 {
    let now = unsafe { performance.now() };
    return now as f64 * 1000.0 * 1000.0;
}

#[wasm_bindgen]
pub fn update_world(args: JsValue, elapsed_micro: i32) -> Result<JsValue, JsValue> {
    let args = custom_deserialize::<UpdateWorldArgs>(args)?;

    if elapsed_micro < 0 {
        return Err(JsValue::from_str(
            format!("Negative elapsed_micro: {}, can't update", elapsed_micro).as_str(),
        ));
    }

    let new_state = execute_update_world(elapsed_micro, args);

    Ok(custom_serialize(&new_state)?)
}

#[wasm_bindgen]
pub fn update_world_incremental(args: JsValue, elapsed_micro: i32) -> Result<JsValue, JsValue> {
    let args = custom_deserialize::<UpdateWorldIncrementalArgs>(args)?;

    if elapsed_micro < 0 {
        return Err(JsValue::from_str(
            format!("Negative elapsed_micro: {}, can't update", elapsed_micro).as_str(),
        ));
    }

    let cached_state = {
        let guard = cached_states.read().unwrap();
        let cached_state = guard.get(&args.state_tag);

        if cached_state.is_none() {
            return Err(JsValue::from_str(
                format!(
                    "Cached state by tag {} was not found. Cannot do incremental update",
                    args.state_tag
                )
                .as_str(),
            ));
        }
        cached_state.unwrap().clone() // could be optimized, but for that update_world has to stop owning the argument
    };

    let new_state = execute_update_world(
        elapsed_micro,
        UpdateWorldArgs {
            state: cached_state,
            limit_area: args.limit_area,
            client: args.client,
            force_non_determinism: args.force_non_determinism,
            state_tag: Some(args.state_tag),
        },
    );

    Ok(custom_serialize(&new_state)?)
}

fn execute_update_world(elapsed_micro: i32, mut args: UpdateWorldArgs) -> GameState {
    let mut prng = get_continuous_state_prng(&mut args.state);
    let (new_state, sampler, _) = world::update_world(
        args.state,
        elapsed_micro as i64,
        args.client.unwrap_or(true),
        get_sampler_clone(),
        world::UpdateOptions {
            limit_area: args.limit_area,
            force_non_determinism: args.force_non_determinism,
        },
        &mut prng,
        &get_current_d_table(),
        &mut game_state_caches.write().unwrap(),
    );
    try_save_cached_state(&new_state, args.state_tag);

    if *ENABLE_PERF {
        mem::replace(global_sampler.write().unwrap().deref_mut(), sampler);

        let last_flush = {
            let guard = timers.read().unwrap();
            guard.last_perf_flush_at_ticks
        } as i32;
        let diff = (new_state.millis as i32 - last_flush).abs();
        if diff > PERF_CONSUME_TIME_MS {
            timers.write().unwrap().last_perf_flush_at_ticks = new_state.millis;
            flush_sampler_stats();
        }
    }
    new_state
}

fn try_save_cached_state(state: &GameState, state_tag: Option<String>) {
    if let Some(tag) = state_tag {
        let mut guard = cached_states.write().unwrap();
        guard.insert(tag, state.clone());
    }
}

#[wasm_bindgen]
pub fn flush_sampler_stats() {
    if *ENABLE_PERF {
        let (sampler_out, metrics) = global_sampler
            .write()
            .unwrap()
            .clone()
            .consume(ConsumeOptions::default());
        mem::replace(global_sampler.write().unwrap().deref_mut(), sampler_out);
        log!("------");
        log!(format!(
            "performance stats over {} sec \n{}",
            PERF_CONSUME_TIME_MS / 1000 / 1000,
            metrics
                .into_iter()
                .map(|m| m.0)
                .collect::<Vec<_>>()
                .join("\n")
        ));
        log!("------");
    } else {
        // log!("ENABLE_PERF is disabled, flushing stats is useless");
    }
}

fn get_sampler_clone() -> Sampler {
    if *ENABLE_PERF {
        global_sampler.read().unwrap().clone()
    } else {
        perf::Sampler::new(vec![])
    }
}

#[derive(Clone, Debug, derive_serialize, derive_deserialize)]
struct SeedWorldArgs {
    seed: String,
    mode: GameMode,
    gen_state_opts: Option<GenStateOpts>,
}

use crate::interpolation::gen_rel_position_orbit_phase_table;
use crate::replay::{ReplayDiffed, ReplayRaw, ValueDiff};
use crate::trajectory::TrajectoryRequest;
use combat::Projectile;
use serde_wasm_bindgen::*;
use spatial_movement::Movement;

pub fn custom_serialize<T: Serialize>(arg: &T) -> Result<JsValue, JsValue> {
    let ser = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    let res = arg
        .serialize(&ser)
        .map_err(|e| JsValue::from_str(e.to_string().as_str()));
    res
}

#[wasm_bindgen]
pub fn seed_world(args: JsValue) -> Result<JsValue, JsValue> {
    let args: SeedWorldArgs = serde_wasm_bindgen::from_value(args)?;
    let state = system_gen::seed_state(
        &args.mode,
        args.seed,
        args.gen_state_opts,
        &mut (*game_state_caches.write().unwrap()),
    );
    Ok(custom_serialize(&state)?)
}

#[derive(Clone, Debug, derive_deserialize, derive_serialize)]
struct CreateRoomArgs {
    mode: GameMode,
    seed: String,
    bots_seed: Option<String>,
    gen_state_opts: Option<GenStateOpts>,
}

#[wasm_bindgen]
pub fn create_room(args: JsValue) -> Result<JsValue, JsValue> {
    let args: CreateRoomArgs = serde_wasm_bindgen::from_value(args)?;
    let mut prng = seed_prng(args.seed);
    let (_, room) = world::make_room(
        &args.mode,
        prng_id(&mut prng),
        &mut prng,
        args.bots_seed,
        args.gen_state_opts,
        Some(&mut game_state_caches.write().unwrap()),
    );
    Ok(serde_wasm_bindgen::to_value(&room)?)
}

#[wasm_bindgen]
pub fn update_room(
    room: JsValue,
    elapsed_micro: i64,
    d_table: JsValue,
) -> Result<JsValue, JsValue> {
    let mut room: Room = serde_wasm_bindgen::from_value(room)?;
    let d_table: DialogueTable = serde_wasm_bindgen::from_value(d_table)?;
    let mut prng = get_continuous_room_prng(&mut room);
    let (_indexes, _sampler) = world::update_room(
        &mut prng,
        get_sampler_clone(),
        elapsed_micro,
        &mut room,
        &d_table,
        Some(&mut game_state_caches.write().unwrap()),
    );
    Ok(custom_serialize(&room)?)
}

fn get_continuous_room_prng(room: &mut Room) -> Mcg128Xsl64 {
    let mut prng = if let Some(next_seed) = room.next_seed.as_ref() {
        Pcg64Mcg::seed_from_u64((*next_seed as u64))
    } else {
        let seed = room.state.seed.clone();
        seed_prng(seed)
    };
    room.next_seed = Some(prng.next_u32());
    prng
}

fn get_continuous_state_prng(state: &mut GameState) -> Mcg128Xsl64 {
    let mut prng = if let Some(next_seed) = state.next_seed.as_ref() {
        Pcg64Mcg::seed_from_u64((*next_seed as u64))
    } else {
        let seed = state.seed.clone();
        seed_prng(seed)
    };
    state.next_seed = Some(prng.next_u32());
    prng
}

#[wasm_bindgen]
pub fn update_room_full(
    room: JsValue,
    total_ticks: i32,
    step_ticks: i32,
) -> Result<JsValue, JsValue> {
    let mut room: Room = serde_wasm_bindgen::from_value(room)?;
    let mut sampler = get_sampler_clone();
    let mut prng = get_continuous_room_prng(&mut room);
    let mut remaining = total_ticks;
    while remaining > 0 {
        remaining -= step_ticks;
        let (_indexes, _sampler) = world::update_room(
            &mut prng,
            sampler,
            step_ticks as i64,
            &mut room,
            &get_current_d_table(),
            Some(&mut game_state_caches.write().unwrap()),
        );
        sampler = _sampler;
    }
    Ok(custom_serialize(&room)?)
}

fn get_current_d_table() -> DialogueTable {
    current_d_table.read().unwrap().clone().expect(
        "no preloaded dialogue table while calling get_current_d_table. call .load_d_table first",
    )
}

#[wasm_bindgen]
pub fn make_dialogue_table(dir_contents: JsValue) -> Result<JsValue, JsValue> {
    let mut res = vec![];
    let dir_contents: HashMap<String, String> = serde_wasm_bindgen::from_value(dir_contents)?;
    for (key, value) in dir_contents.into_iter() {
        res.push(parse_dialogue_script_from_file(key.as_str(), value));
    }
    let mut d_table = DialogueTable::new();
    for s in res {
        d_table.scripts.insert(s.id, s);
    }
    Ok(serde_wasm_bindgen::to_value(&d_table)?)
}

// mega-ugly hack to keep ENABLE_PERF as a global static boolean (and not something more complex)
// since it's lazy_static, then it'll init on the first access. meaning, if this function is called before,
// the init code can consume whatever set here
#[wasm_bindgen]
pub fn set_enable_perf(value: bool) {
    *ENABLE_PERF_HACK_INIT.write().unwrap() = value;
    if value {
        log!(format!("ENABLE_PERF was set to {}", value))
    }
}

#[wasm_bindgen]
pub fn friend_or_foe(
    state: JsValue,
    actor_a: JsValue,
    actor_b: JsValue,
    loc_idx: usize,
) -> Result<JsValue, JsValue> {
    let mut state: GameState = serde_wasm_bindgen::from_value(state)?;
    let res = fof::friend_or_foe(
        &state,
        serde_wasm_bindgen::from_value::<FofActor>(actor_a)?,
        serde_wasm_bindgen::from_value::<FofActor>(actor_b)?,
        loc_idx,
    );
    Ok(custom_serialize(&res)?)
}

#[wasm_bindgen]
pub fn pack_replay(states: Vec<JsValue>, name: String, diff: bool) -> Result<JsValue, JsValue> {
    return if diff {
        let mut replay = ReplayDiffed::new(new_id());
        replay.name = name;
        for state in states.into_iter() {
            let mut state: GameState = serde_wasm_bindgen::from_value(state)?;
            replay.add(state);
        }
        replay.current_state = None;
        Ok(custom_serialize(&replay)?)
    } else {
        let mut replay = ReplayRaw::new(new_id());
        replay.name = name;
        for state in states.into_iter() {
            let mut state: GameState = serde_wasm_bindgen::from_value(state)?;
            replay.add(state);
        }
        replay.current_state = None;
        Ok(custom_serialize(&replay)?)
    };
}

#[wasm_bindgen]
pub fn get_diff_replay_state_at(replay: JsValue, ticks: u32) -> Result<JsValue, JsValue> {
    let mut sampler = if *ENABLE_PERF {
        Some(global_sampler.write().unwrap().clone())
    } else {
        None
    };
    let full_id = sampler
        .as_mut()
        .map(|s| s.start(SamplerMarks::GetDiffReplayStateAtFull as u32));
    let mut replay: ReplayDiffed = serde_wasm_bindgen::from_value(replay)?;
    let res = replay
        .get_state_at(ticks, &mut sampler)
        .map_err(|_| JsValue::from_str("failed to rewind"))?;
    let value = custom_serialize(&res)?;
    sampler.as_mut().map(|s| {
        full_id.map(|fid| s.end(fid));
    });
    if *ENABLE_PERF {
        mem::replace(
            global_sampler.write().unwrap().deref_mut(),
            sampler.unwrap(),
        );
    };
    flush_sampler_stats();
    Ok(value)
}

#[wasm_bindgen]
pub fn get_preloaded_diff_replay_state_at(ticks: u32) -> Result<JsValue, JsValue> {
    let mut sampler = if *ENABLE_PERF {
        Some(global_sampler.write().unwrap().clone())
    } else {
        None
    };
    let full_id = sampler
        .as_mut()
        .map(|s| s.start(SamplerMarks::GetDiffReplayStateAtPreloaded as u32));
    let mut replay: ReplayDiffed = current_replay.read().unwrap().clone().unwrap();
    let res = replay
        .get_state_at(ticks, &mut sampler)
        .map_err(|_| JsValue::from_str("failed to rewind"))?;
    sampler.as_mut().map(|s| {
        full_id.map(|fid| s.end(fid));
    });
    current_replay
        .write()
        .unwrap()
        .as_mut()
        .map(|r: &mut ReplayDiffed| {
            r.current_state = Some(res.clone());
        });
    let value = custom_serialize(&res)?;
    if *ENABLE_PERF {
        mem::replace(
            global_sampler.write().unwrap().deref_mut(),
            sampler.unwrap(),
        );
    };
    flush_sampler_stats();
    Ok(value)
}

#[wasm_bindgen]
pub fn get_preloaded_diff_replay_state_at_interpolated(
    prev_ticks: u32,
    next_ticks: u32,
    value: f64,
) -> Result<JsValue, JsValue> {
    let mut sampler = if *ENABLE_PERF {
        Some(global_sampler.write().unwrap().clone())
    } else {
        None
    };
    let mut caches = game_state_caches.write().unwrap();
    let full_id = sampler
        .as_mut()
        .map(|s| s.start(SamplerMarks::GetDiffReplayStateAtPreloadedInterpolated as u32));
    let mut replay: ReplayDiffed = current_replay.read().unwrap().clone().unwrap();
    let (prev, next, curr) = replay
        .get_state_at_interpolated(prev_ticks, next_ticks, value, &mut sampler, &mut caches)
        .map_err(|_| JsValue::from_str("failed to rewind"))?;
    sampler.as_mut().map(|s| {
        full_id.map(|fid| s.end(fid));
    });
    current_replay
        .write()
        .unwrap()
        .as_mut()
        .map(|r: &mut ReplayDiffed| {
            r.current_state = Some(prev);
            r.next_state = Some(next);
        });
    let value = custom_serialize(&curr)?;
    if *ENABLE_PERF {
        mem::replace(
            global_sampler.write().unwrap().deref_mut(),
            sampler.unwrap(),
        );
    };
    flush_sampler_stats();
    Ok(value)
}

#[wasm_bindgen]
pub fn load_replay(replay: JsValue) -> Result<(), JsValue> {
    let replay: ReplayDiffed = serde_wasm_bindgen::from_value(replay)?;
    let mut r = current_replay.write().unwrap();
    *r = Some(replay);
    Ok(())
}

#[wasm_bindgen]
pub fn load_d_table(d_table: JsValue) -> Result<(), JsValue> {
    let d_table: DialogueTable = custom_deserialize(d_table)?;
    let mut r = current_d_table.write().unwrap();
    *r = Some(d_table);
    Ok(())
}

#[wasm_bindgen]
pub fn interpolate_states(
    state_a: JsValue,
    state_b: JsValue,
    value: f64,
    options: JsValue,
) -> Result<JsValue, JsValue> {
    let mut guard = game_state_caches.write().unwrap();
    let state_a: GameState = custom_deserialize(state_a)?;
    let state_b: GameState = custom_deserialize(state_b)?;
    let options: UpdateOptionsV2 = serde_wasm_bindgen::from_value(options)?;
    let result = interpolation::interpolate_states(
        &state_a,
        &state_b,
        value,
        &mut guard,
        options,
        &mut Sampler::empty(),
    );
    Ok(custom_serialize(&result)?)
}

fn custom_deserialize<T: serde::de::DeserializeOwned + std::fmt::Debug>(
    val: JsValue,
) -> Result<T, JsValue> {
    Ok(serde_wasm_bindgen::from_value::<T>(val)?)
}

#[wasm_bindgen]
pub fn apply_single_patch(state: JsValue, patch: JsValue) -> Result<JsValue, JsValue> {
    let state: GameState = custom_deserialize(state)?;
    let batch: Vec<ValueDiff> = custom_deserialize(patch)?;
    let res = ReplayDiffed::apply_diff_batch(&state, &batch)
        .map_err(|_| JsValue::from_str("failed to apply single patch"))?;
    Ok(custom_serialize(&res)?)
}

pub fn get_uuid(str: JsValue) -> Uuid {
    serde_wasm_bindgen::from_value::<Uuid>(str).ok().unwrap()
}

#[wasm_bindgen]
pub fn build_dialogue_from_state(
    dialogue_id: JsValue,
    current_state: JsValue,
    player_id: JsValue,
    game_state: JsValue,
) -> Result<JsValue, JsValue> {
    let dialogue_state = dialogue::build_dialogue_from_state(
        get_uuid(dialogue_id),
        &Box::new(Some(get_uuid(current_state))),
        &get_current_d_table(),
        get_uuid(player_id),
        &serde_wasm_bindgen::from_value::<GameState>(game_state)?,
    );
    match dialogue_state {
        None => Err(JsValue::from_str("couldn't build dialogue state")),
        Some(v) => Ok(custom_serialize(&v)?),
    }
}

#[wasm_bindgen]
pub fn generate_phase_table(period: f64, dist: f64) -> Result<JsValue, JsValue> {
    let res = gen_rel_position_orbit_phase_table(
        &Movement::RadialMonotonous {
            full_period_ticks: period,
            anchor: ObjectSpecifier::Unknown,
            relative_position: None,
            phase: None,
            start_phase: 0,
        },
        dist,
    );
    Ok(custom_serialize(&res)?)
}

#[wasm_bindgen]
pub fn self_inspect() {
    self_inspect::declare();
}

#[wasm_bindgen]
pub fn build_trajectory(req: JsValue, mov: JsValue, spat: JsValue) -> Result<JsValue, JsValue> {
    let res = trajectory::build_trajectory_accelerated(
        custom_deserialize::<TrajectoryRequest>(req)?,
        &custom_deserialize::<Movement>(mov)?,
        &custom_deserialize::<SpatialProps>(spat)?,
    );
    Ok(custom_serialize(&res)?)
}

#[derive(Serialize, Deserialize, Debug)]
struct GuidedProjectileArgs {
    projectile: Projectile,
    target_spatial: SpatialProps,
    elapsed_micro: i32,
}

#[derive(Serialize, Deserialize)]
struct GuidedProjectileRes {
    gas: f64,
    turn: f64,
    brake: f64,
}

#[wasm_bindgen]
pub fn guide_projectile(val: JsValue) -> Result<JsValue, JsValue> {
    let mut args = custom_deserialize::<GuidedProjectileArgs>(val)?;
    let (gas, turn, brake) = combat::guide_projectile(
        &mut args.projectile,
        &args.target_spatial,
        args.elapsed_micro as i64,
    );
    Ok(custom_serialize(&GuidedProjectileRes { gas, turn, brake })?)
}
