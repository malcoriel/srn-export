use serde::de::SeqAccess;
use serde::ser::SerializeSeq;
use uuid::Uuid;
use std::collections::HashMap;
use std::iter::FromIterator;
use std::str::FromStr;
use itertools::Itertools;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use crate::{DialogueTable, GameMode, GameState, get_prng, new_id, world};
use crate::system_gen::seed_state;
use serde_derive::{Deserialize, Serialize};
use treediff::tools::{ChangeType, Recorder};
use treediff::diff;
use treediff::tools::ChangeType::{Added, Modified, Removed};
use treediff::Value;
use treediff::value::*;
use serde_json::*;

#[derive(Serialize, Deserialize)]
pub struct ReplayListItem {
    pub id: Uuid,
    pub name: String,
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayFrame {
    pub ticks: u64,
    pub state: GameState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayRaw {
    pub id: Uuid,
    pub name: String,
    pub initial_state: GameState,
    pub current_state: Option<GameState>,
    pub frames: HashMap<u64, ReplayFrame>,
    pub max_time_ms: u64,
    pub current_millis: u64,
    pub marks_ticks: Vec<u64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ValueKey(#[serde(serialize_with = "serialize_key", deserialize_with="deserialize_key")]Key);

fn serialize_key<S>(value: &Key, serializer: S) -> std::result::Result<<S as Serializer>::Ok, <S as Serializer>::Error> where S: Serializer {
    match value {
        Key::Index(i) => {
            serializer.serialize_u32((*i) as u32)
        }
        Key::String(str) => {
            serializer.serialize_str(str.as_str())
        }
    }
}

fn deserialize_key<'de, D>(deserializer: D) -> std::result::Result<Key, D::Error>
    where
        D: Deserializer<'de>,
{
    let s: &str = Deserialize::deserialize(deserializer)?;
    let res = usize::from_str(s);
    if res.is_err() {
        return Ok(Key::String(s.to_string()));
    }
    return Ok(Key::Index(res.unwrap()));
}



#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ValueDiff {
    Unchanged,
    Added(Vec<ValueKey>, serde_json::Value),
    Modified(Vec<ValueKey>, serde_json::Value),
    Removed(Vec<ValueKey>),
}

impl ValueDiff {
    pub fn from_change_type(ct: &ChangeType<Key, serde_json::Value>) -> ValueDiff {
        match ct {
            Removed(k, _) => {
                ValueDiff::Removed(Self::map_key(k.clone()))
            }
            Added(k, v) => {
                ValueDiff::Added(Self::map_key(k.clone()), (*v).clone())
            }
            ChangeType::Unchanged(_, _) => {
                ValueDiff::Unchanged
            }
            Modified(k, _, v) => {
                ValueDiff::Modified(Self::map_key(k.clone()), (*v).clone())
            }
        }
    }

    fn map_key(k: Vec<Key>) -> Vec<ValueKey> {
        k.into_iter().map(|k| ValueKey(k)).collect()
    }
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiffBatch {
    pub diffs: Vec<ValueDiff>
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayDiffed {
    pub id: Uuid,
    pub name: String,
    pub initial_state: GameState,
    pub current_state: Option<GameState>,
    pub diffs: Vec<DiffBatch>,
    pub max_time_ms: u64,
    pub current_millis: u64,
    pub marks_ticks: Vec<u64>,
}


impl ReplayRaw {
    pub fn new(id: Uuid) -> Self {
        ReplayRaw {
            id,
            name: "".to_string(),
            initial_state: GameState::new(),
            current_state: None,
            frames: Default::default(),
            max_time_ms: 0,
            current_millis: 0,
            marks_ticks: vec![]
        }
    }

    pub fn add(&mut self, state: GameState) {
        let millis = state.millis.clone();
        let ticks = state.ticks.clone();
        if self.frames.len() == 0 {
            self.initial_state = state.clone();
        }
        self.frames.insert(state.ticks,ReplayFrame {
            ticks: state.ticks,
            state
        });
        self.max_time_ms = millis as u64;
        self.marks_ticks.push(ticks);
    }
}

impl ReplayDiffed {
    pub fn new(id: Uuid) -> Self {
        ReplayDiffed {
            id,
            name: "".to_string(),
            initial_state: GameState::new(),
            current_state: None,
            diffs: Default::default(),
            max_time_ms: 0,
            current_millis: 0,
            marks_ticks: vec![]
        }
    }

    pub fn add(&mut self, state: GameState) {
        let millis = state.millis.clone();
        let ticks = state.ticks.clone();
        if self.diffs.len() == 0 {
            self.initial_state = state.clone();
        } else {
            self.build_current();
            self.diffs.push(ReplayDiffed::calc_diff_batch(&self.current_state.clone().unwrap(), &state));
        }
        self.max_time_ms = millis as u64;
        self.marks_ticks.push(ticks);
    }

    fn build_current(&mut self) {
        self.current_state = Some(ReplayDiffed::apply_diffs(&self.initial_state, &self.diffs));
    }

    fn apply_diffs(from: &GameState, batches: &Vec<DiffBatch>) -> GameState {
        let mut current = from.clone();
        for batch in batches {
            for diff in batch.diffs.iter() {
                current = ReplayDiffed::apply_diff(current, diff);
            }
        }
        current
    }

    fn apply_diff(from: GameState, diff: &ValueDiff) -> GameState {
        todo!()
    }

    fn calc_diff_batch<'a>(from: & 'a GameState, to: & 'a GameState) -> DiffBatch {
        let from: serde_json::Value = serde_json::to_value(from).expect("Couldn't erase typing");
        let to: serde_json::Value = serde_json::to_value(to).expect("Couldn't erase typing");
        let mut d = Recorder::default();
        diff(&from, &to, &mut d);
        let diffs = d.calls.iter().map(|c| ValueDiff::from_change_type(c)).collect();
        DiffBatch {
            diffs
        }
    }
}

