use std::collections::HashMap;
use std::iter::FromIterator;
use itertools::Itertools;
use rocket_contrib::json::Json;
use uuid::Uuid;
use crate::{DialogueTable, GameMode, GameState, get_prng, new_id, Sampler, SpatialIndexes, UpdateOptions, world};
use serde_derive::{Deserialize, Serialize};
use crate::system_gen::seed_state;

#[derive(Serialize, Deserialize)]
pub struct ReplayListItem {
    pub id: Uuid,
    pub name: String,
}

#[get("/")]
pub fn get_saved_replays() -> Json<Vec<ReplayListItem>> {
    Json(vec![ReplayListItem {
        id: new_id(),
        name: "test".to_string(),
    }])
}


#[derive(Serialize, Deserialize)]
pub struct ReplayFrame {
    pub ticks: u64,
    pub state: GameState,
}



#[derive(Serialize, Deserialize)]
pub struct Replay {
    pub initial_state: GameState,
    pub current_state: Option<GameState>,
    pub frames: HashMap<u64, ReplayFrame>,
    pub max_time_ms: u64,
    pub current_millis: u64,
    pub marks: Vec<u64>,
}

#[get("/<replay_id>")]
pub fn get_replay_by_id(replay_id: String) -> Json<Replay> {
    let state = seed_state(&GameMode::CargoRush, "123".to_string());
    let mut frames = vec![];
    for i in 0..10 {
        let (frame_state, _) = world::update_world(state.clone(), 16 * 100 * 1000 * i + 1, false, Sampler::empty(), UpdateOptions::new(),
                                                   &mut SpatialIndexes::new(), &mut get_prng(), &mut HashMap::new(), &DialogueTable {
                scripts: HashMap::new()
            });
        frames.push(ReplayFrame {
            ticks: frame_state.ticks,
            state: frame_state,
        });
    }
    let max_time_ms = frames[frames.len() - 1].state.millis as u64;
    let map = HashMap::from_iter(frames.into_iter().map(|f| (f.ticks, f)).collect::<Vec<(u64, ReplayFrame)>>());
    let marks = map.keys().map(|k| k.clone()).collect::<Vec<u64>>().into_iter().sorted().collect();
    Json(Replay {
        initial_state: state.clone(),
        current_state: None,
        frames: map,
        max_time_ms,
        current_millis: 0,
        marks,
    })
}
