use std::collections::{HashMap, HashSet};
use std::{fs, thread};
use std::fs::{DirEntry, ReadDir};
use std::iter::FromIterator;
use std::path::Path;
use std::str::FromStr;
use std::thread::Thread;
use std::time::Duration;
use itertools::Itertools;
use lazy_static::lazy_static;
use rocket_contrib::json::Json;
use uuid::Uuid;
use crate::{DialogueTable, GameMode, GameState, get_prng, new_id, Sampler, SpatialIndexes, UpdateOptions, world};
use serde_derive::{Deserialize, Serialize};
use crate::system_gen::seed_state;
use mut_static::MutStatic;
use crate::resources::{get_jsons_from_res_dir, read_json, read_json_from_res_dir};

lazy_static! {
    pub static ref REPLAYS_STORE: MutStatic<HashMap<Uuid, Replay>> = {
        MutStatic::from(HashMap::new())
    };
}

fn check_for_new_replays() {
    let files = get_jsons_from_res_dir("replays");
    let existing_keys = REPLAYS_STORE.read().unwrap().keys().map(|k| k.to_string().clone()).collect::<Vec<String>>();
    let existing_keys_set : HashSet<String> = HashSet::from_iter(existing_keys);
    let mut to_pick: Vec<Replay> = vec![];
    for file in files {
        if !existing_keys_set.contains(&file) {
            log!(format!("found a new replay {}", file));
            to_pick.push(read_json_from_res_dir("replays", file));
        }
    }
    {
        let mut store = REPLAYS_STORE.write().unwrap();
        for replay in to_pick {
            store.insert(replay.id, replay);
        }
    }
}

pub fn watch_replay_folder() {
    loop {
        check_for_new_replays();
        thread::sleep(Duration::from_secs(5));
    }
}

#[derive(Serialize, Deserialize)]
pub struct ReplayListItem {
    pub id: Uuid,
    pub name: String,
}

#[get("/")]
pub fn get_saved_replays() -> Json<Vec<ReplayListItem>> {
    let list = {
        let store = REPLAYS_STORE.read().unwrap();
        (*store).iter().map(|(k, v)| {
            ReplayListItem {
                id: k.clone(),
                name: v.name.clone(),
            }
        }).collect::<Vec<ReplayListItem>>()
    };
    Json(list)
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayFrame {
    pub ticks: u64,
    pub state: GameState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Replay {
    pub id: Uuid,
    pub name: String,
    pub initial_state: GameState,
    pub current_state: Option<GameState>,
    pub frames: HashMap<u64, ReplayFrame>,
    pub max_time_ms: u64,
    pub current_millis: u64,
    pub marks: Vec<u64>,
}

#[get("/<replay_id>")]
pub fn get_replay_by_id(replay_id: String) -> Json<Option<Replay>> {
    let item = {
        let store = REPLAYS_STORE.read().unwrap();
        let item = Uuid::from_str(replay_id.as_str()).ok().and_then(|id| store.get(&id).map(|r| r.clone()));
        item
    };
    Json(item)
}

fn make_test_replay() -> Replay {
    let mut state = seed_state(&GameMode::CargoRush, "123".to_string());
    let mut frames = vec![];
    frames.push(ReplayFrame {
        ticks: 0,
        state: state.clone()
    });
    for _i in 0..100 {
        let (frame_state, _) = world::update_world(state.clone(), 1600 * 1000 + 1, false, Sampler::empty(), UpdateOptions::new(),
                                                   &mut SpatialIndexes::new(), &mut get_prng(), &mut HashMap::new(), &DialogueTable {
                scripts: HashMap::new()
            });
        frames.push(ReplayFrame {
            ticks: frame_state.ticks,
            state: frame_state.clone(),
        });
        state = frame_state;
    }
    let max_time_ms = frames[frames.len() - 1].state.millis as u64;
    let map = HashMap::from_iter(frames.into_iter().map(|f| (f.ticks, f)).collect::<Vec<(u64, ReplayFrame)>>());
    let marks = map.keys().map(|k| k.clone()).collect::<Vec<u64>>().into_iter().sorted().collect();
    let replay = Replay {
        id: new_id(),
        initial_state: state.clone(),
        current_state: None,
        frames: map,
        max_time_ms,
        current_millis: 0,
        marks,
        name: "test".to_string(),
    };
    replay
}
