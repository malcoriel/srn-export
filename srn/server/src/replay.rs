use serde::de::SeqAccess;
use serde::ser::SerializeSeq;
use uuid::Uuid;
use std::collections::HashMap;
use std::iter::FromIterator;
use std::str::FromStr;
use std::result::Result;
use itertools::Itertools;
use serde::{Deserializer, Serializer};
use crate::{DialogueTable, GameMode, GameState, get_prng, new_id, Sampler, world};
use crate::system_gen::seed_state;
use serde_derive::{Deserialize, Serialize};
use treediff::tools::{ChangeType, Recorder};
use treediff::diff;
use treediff::tools::ChangeType::{Added, Modified, Removed};
use treediff::Value;
use treediff::value::*;
use json_patch::{AddOperation, patch, Patch, PatchError, PatchOperation, RemoveOperation, ReplaceOperation};
use serde_json::from_str;
use crate::perf::SamplerMarks;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ReplayError {
    Unknown,
    BadPatch,
    InvalidRewind(u32)
}

#[derive(Serialize, Deserialize)]
pub struct ReplayListItem {
    pub id: Uuid,
    pub name: String,
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayFrame {
    pub ticks: u32,
    pub state: GameState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayRaw {
    pub id: Uuid,
    pub name: String,
    pub initial_state: GameState,
    pub current_state: Option<GameState>,
    pub frames: Vec<ReplayFrame>,
    pub max_time_ms: u32,
    pub current_millis: f64,
    pub marks_ticks: Vec<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ValueKey(#[serde(serialize_with = "serialize_key", deserialize_with = "deserialize_key")]Key);

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
    let s: &str = serde::Deserialize::deserialize(deserializer)?;
    let res = usize::from_str(s);
    if res.is_err() {
        return Ok(Key::String(s.to_string()));
    }
    return Ok(Key::Index(res.unwrap()));
}


pub fn to_patch_path(path: Vec<ValueKey>) -> String {
    return format!("/{}", path.into_iter().map(|k| k.0.to_string()).join("/"));
}

pub fn to_patch_path_k(path: Vec<Key>) -> String {
    return format!("/{}", path.into_iter().map(|k| k.to_string()).join("/"));
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ValueDiff {
    Unchanged,
    Added(String, serde_json::Value),
    Modified(String, serde_json::Value),
    Removed(String),
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

    fn map_key(k: Vec<Key>) -> String {
        to_patch_path_k(k)
    }
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReplayDiffed {
    pub id: Uuid,
    pub name: String,
    pub initial_state: GameState,
    pub current_state: Option<GameState>,
    pub diffs: Vec<Vec<ValueDiff>>,
    pub max_time_ms: u32,
    pub current_millis: f64,
    pub marks_ticks: Vec<u32>,
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
            current_millis: 0.0,
            marks_ticks: vec![],
        }
    }

    pub fn add(&mut self, state: GameState) {
        let millis = state.millis.clone();
        let ticks = state.ticks.clone();
        if self.frames.len() == 0 {
            self.initial_state = state.clone();
        }
        self.frames.push( ReplayFrame {
            ticks: state.ticks as u32,
            state,
        });
        self.max_time_ms = millis as u32;
        self.marks_ticks.push(ticks as u32);
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
            current_millis: 0.0,
            marks_ticks: vec![],
        }
    }

    pub fn add(&mut self, state: GameState) -> Result<(), ReplayError> {
        if self.initial_state.id == Uuid::default() {
            self.marks_ticks.push(state.ticks as u32);
            self.initial_state = state;
            return Ok(());
        }
        let millis = state.millis.clone();
        let ticks = state.ticks.clone();
        if self.current_state.is_none() {
            self.current_state = Some(self.initial_state.clone());
        }
        let new_diff = ReplayDiffed::calc_diff_batch(&self.current_state.clone().unwrap(), &state);
        self.update_current(&new_diff)?;
        self.diffs.push(new_diff);
        self.max_time_ms = millis as u32;
        self.marks_ticks.push(ticks as u32);
        Ok(())
    }

    fn update_current(&mut self, new_diff: &Vec<ValueDiff>) -> Result<(), ReplayError> {
        if let Some(current_state) = &self.current_state {
            self.current_state = Some(ReplayDiffed::apply_diff_batch(&current_state, new_diff)?);
        }
        Ok(())
    }

    //noinspection RsTypeCheck
    pub fn debug_patch(state: &mut serde_json::Value, p: &Patch) {
        warn!("Patching in ReplayDiffed has failed, attempting to find bad op...");
        for i in 0..p.0.len() {
            let mut current = state.clone();
            let new_patch = Patch(p.0.iter().take(i + 1).map(|o| o.clone()).collect());
            let last_op = new_patch.0.last().unwrap().clone();
            if patch(&mut current, &new_patch).is_err() {
                warn!(format!("Found bad op {:?}", last_op));
                return;
            }
        }
        warn!("No bad op found");
    }

    //noinspection RsTypeCheck
    pub fn apply_diff_batch(from: &GameState, batch: &Vec<ValueDiff>) -> Result<GameState, ReplayError> {
        let transformed_diffs: Vec<PatchOperation> = batch.iter().filter_map(|diff| match diff {
            ValueDiff::Unchanged => {
                None
            }
            ValueDiff::Added(path, v) => {
                Some(PatchOperation::Add(AddOperation { path: path.clone(), value: v.clone() }))
            }
            ValueDiff::Modified(path, v) => {
                Some(PatchOperation::Replace(ReplaceOperation { path: path.clone(), value: v.clone() }))
            }
            ValueDiff::Removed(path) => {
                Some(PatchOperation::Remove(RemoveOperation { path: path.clone() }))
            }
        }).collect();
        let p = Patch(transformed_diffs);

        let mut current = serde_json::to_value(from).expect("Couldn't erase typing");

        let result = patch(&mut current, &p);
        if result.is_err() {
            Self::debug_patch(&mut current, &p);
        }


        return match result {
            Ok(()) => {
                Ok(serde_json::from_value::<GameState>(current).expect("Couldn't restore typing"))
            }
            Err(e) => {
                warn!(format!("bad patch {:?}", e));
                Err(ReplayError::BadPatch)
            }
        };
    }

    fn calc_diff_batch<'a>(from: &'a GameState, to: &'a GameState) -> Vec<ValueDiff> {
        let from: serde_json::Value = serde_json::to_value(from).expect("Couldn't erase typing");
        let to: serde_json::Value = serde_json::to_value(to).expect("Couldn't erase typing");
        let mut d = Recorder::default();
        diff(&from, &to, &mut d);
        let mut diffs:Vec<ValueDiff> = d.calls.iter().filter_map(|c| {
            let diff = ValueDiff::from_change_type(c);
            if matches!(diff, ValueDiff::Unchanged) {
                return None;
            }
            return Some(diff);
        }).collect();
        // patch array removal that will break if removed in the order it was detected
        // e.g. 7, 8, 9 will break on the 3rd removal, but 9, 8, 7 will not
        let mut skip_till: i32 = -1;
        let mut sequences:Vec<(usize, Vec<ValueDiff>)> = vec![];
        for i in 0..diffs.len() {
            if i as i32 <= skip_till {
                continue;
            }
            if matches!(diffs[i], ValueDiff::Removed(_)) {
                let mut accumulated = vec![diffs[i].clone()];
                let mut main_key = match diffs[i].clone() {
                    ValueDiff::Removed(path) => Some(path),
                    _ => None
                }.unwrap();
                let parts = main_key.split("/").collect::<Vec<&str>>();
                main_key = parts.iter().take(parts.len() - 1).join("/");
                for j in (i + 1)..diffs.len() {
                    match &diffs[j] {
                        ValueDiff::Removed(path) => {
                            if path.starts_with(&main_key) {
                                accumulated.push(diffs[j].clone())
                            } else {
                                break;
                            }
                        },
                        _ => {
                            break;
                        }
                    }
                    skip_till = j as i32;
                }
                if accumulated.len() > 1 {
                    sequences.push((i, accumulated.into_iter().rev().collect()))
                }
            }
        }
        if !sequences.is_empty() {
            for (i, accumulated) in sequences {
                for j in 0..accumulated.len() {
                    diffs[i + j] = accumulated[j].clone()
                }
            }
        }
        diffs
    }

    fn apply_n_diffs(&self, count: usize, sampler: &mut Option<Sampler>, from_idx: usize) -> Result<GameState, ReplayError> {
        let diffs: Vec<Vec<ValueDiff>> = self.diffs.iter().skip(from_idx).take(count).map(|d| d.clone()).collect();
        let mut current = self.current_state.as_ref().unwrap_or(&self.initial_state).clone();
        for batch in diffs {
            let sid = sampler.as_mut().map(|s| {
                s.start(SamplerMarks::ApplyReplayDiffBatch as u32)
            });
            current = Self::apply_diff_batch(&current, &batch)?;
            sampler.as_mut().zip(sid).map(|(s, i)| s.end(i));
        }
        Ok(current)
    }

    pub fn get_state_at(&self, ticks: u32, sampler: &mut Option<Sampler>) -> Result<GameState, ReplayError> {
        let index = self.marks_ticks.iter().position(|mark| *mark == ticks);
        let current_ticks =  self.current_state.as_ref().map_or(0, |s| s.ticks) as u32;
        let current_index = self.marks_ticks.iter().position(|mark| *mark == current_ticks).unwrap_or(0);
        if let Some(index) = index {
            return Ok(self.apply_n_diffs(index - current_index, sampler,  current_index)?);
        }
        return Err(ReplayError::InvalidRewind(self.current_state.as_ref().map_or(0, |s| s.ticks as u32)));
    }
}

