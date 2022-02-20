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
use crate::replay::{ReplayRaw, ReplayDiffed, ReplayFrame, ReplayListItem};
use crate::resources::{get_jsons_from_res_dir, read_json, read_json_from_res_dir};

lazy_static! {
    pub static ref REPLAYS_STORE: MutStatic<HashMap<Uuid, ReplayDiffed>> = {
        MutStatic::from(HashMap::new())
    };
}

fn check_for_new_replays() {
    let files = get_jsons_from_res_dir("replays");
    let existing_keys = REPLAYS_STORE.read().unwrap().keys().map(|k| k.to_string().clone()).collect::<Vec<String>>();
    let existing_keys_set : HashSet<String> = HashSet::from_iter(existing_keys);
    let mut to_pick: Vec<ReplayDiffed> = vec![];
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

#[get("/<replay_id>")]
pub fn get_replay_by_id(replay_id: String) -> Json<Option<ReplayDiffed>> {
    let item = {
        let store = REPLAYS_STORE.read().unwrap();
        let item = Uuid::from_str(replay_id.as_str()).ok().and_then(|id| store.get(&id).map(|r| r.clone()));
        item
    };
    Json(item)
}
