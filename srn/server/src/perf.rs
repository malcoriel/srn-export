use std::collections::HashMap;
use std::fmt;
use std::fmt::{Display, Formatter};

use chrono::{DateTime, Local};
use itertools::{max, min};
use statistical::standard_deviation;
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use uuid::Uuid;

#[derive(Clone)]
pub struct Sampler {
    buckets: HashMap<u32, Vec<u64>>,
    labels: Vec<String>,
    marks: HashMap<Uuid, (u32, DateTime<Local>)>,
    empty: bool,
    pub budget: i32,
}

impl Sampler {
    pub fn new(labels: Vec<String>) -> Sampler {
        let mut buckets = HashMap::new();
        Sampler::init_buckets(&labels, &mut buckets);
        Sampler {
            budget: 0,
            labels,
            buckets,
            marks: HashMap::new(),
            empty: false,
        }
    }

    pub fn empty() -> Sampler {
        Sampler {
            budget: 0,
            labels: vec![],
            buckets: HashMap::new(),
            marks: HashMap::new(),
            empty: true,
        }
    }

    fn init_buckets(labels: &Vec<String>, buckets: &mut HashMap<u32, Vec<u64>>) {
        for i in 0..labels.len() {
            buckets.insert(i as u32, vec![]);
        }
    }

    pub fn add(&mut self, label_idx: u32, val: u64) {
        if self.empty || !crate::ENABLE_PERF {
            return;
        }
        if let Some(bucket) = self.buckets.get_mut(&label_idx) {
            bucket.push(val);
        } else {
            warn!(format!("Invalid label index {}, no bucket", label_idx));
        }
    }

    pub fn consume(mut self) -> (Self, Vec<String>) {
        let mut result = vec![];
        if self.labels.len() != self.buckets.len() {
            warn!(format!(
                "WTF: wrong count of labels {} vs buckets {}",
                self.labels.len(),
                self.buckets.len()
            ));
        } else {
            for i in 0..self.labels.len() {
                let bucket = &self.buckets[&(i as u32)]
                    .iter()
                    .map(|v| v / 1000)
                    .collect::<Vec<_>>();
                let f64bucket = bucket
                    .clone()
                    .into_iter()
                    .map(|v| v as f64)
                    .collect::<Vec<_>>();
                if bucket.len() > 0 {
                    result.push(format!(
                        "{}(µs):n={} mn={:.2} σ={:.2} max={:.2} min={:.2}",
                        &self.labels[i],
                        bucket.len(),
                        bucket.iter().sum::<u64>() as f64 / bucket.len() as f64,
                        if f64bucket.len() >= 2 {
                            standard_deviation(&f64bucket, None)
                        } else {
                            0.0
                        },
                        max(bucket).unwrap_or(&0),
                        min(bucket).unwrap_or(&0),
                    ));
                }
            }
            self.marks.clear();
            self.buckets.clear();
            Sampler::init_buckets(&self.labels, &mut self.buckets);
        }
        (self, result)
    }

    pub fn start(&mut self, label_idx: u32) -> Uuid {
        return if !self.empty {
            let id = crate::new_id();
            let start = Local::now();
            self.mark(label_idx, start, id);
            id
        } else {
            Default::default()
        };
    }

    pub fn end(&mut self, id: Uuid) -> i32 {
        return self.end_impl(id, false);
    }

    pub fn end_top(&mut self, id: Uuid) -> i32 {
        return self.end_impl(id, true);
    }

    fn end_impl(&mut self, id: Uuid, top_level: bool) -> i32 {
        let res = 0;
        if !self.empty {
            if let Some((label_idx, start)) = self.extract_mark(id) {
                let diff = (Local::now() - start).num_nanoseconds().unwrap() as f64;
                self.add(label_idx, diff as u64);
                // since marks can be inside each other,
                // subtracting twice might happen for the inside
                // marks
                if top_level {
                    self.budget -= (diff / 1000.0) as i32;
                }
                return self.budget;
            }
        }
        return res;
    }

    pub fn measure<T, F>(&mut self, target_fn: &F, label_idx: u32) -> T
    where
        F: Fn() -> T,
    {
        if crate::ENABLE_PERF && !self.empty {
            let start = Local::now();
            let res = target_fn();
            let diff = (Local::now() - start).num_nanoseconds().unwrap() as f64;
            self.add(label_idx, diff as u64);
            return res;
        }
        return target_fn();
    }

    pub fn nmeasure<T, F>(&mut self, target_fn: &F, _label_idx: u32) -> T
    where
        F: Fn() -> T,
    {
        return target_fn();
    }

    pub fn measure_mut<T, F>(&mut self, target_fn: &mut F, label_idx: u32) -> T
    where
        F: FnMut() -> T,
    {
        if crate::ENABLE_PERF && !self.empty {
            let start = Local::now();
            let res = target_fn();
            let diff = (Local::now() - start).num_nanoseconds().unwrap() as f64;
            self.add(label_idx, diff as u64);
            return res;
        }
        return target_fn();
    }
    fn mark(&mut self, label_idx: u32, start: DateTime<Local>, id: Uuid) {
        self.marks.insert(id, (label_idx, start));
    }
    fn extract_mark(&self, id: Uuid) -> Option<(u32, DateTime<Local>)> {
        let pair = self.marks.get(&id);
        pair.map(|pair| (pair.0.clone(), pair.1.clone()))
    }
}

pub fn measure_mut<T, F>(target_fn: &mut F, label: &str) -> T
where
    F: FnMut() -> T,
{
    if crate::ENABLE_PERF {
        let start = Local::now();
        let res = target_fn();
        let diff = (Local::now() - start).num_nanoseconds().unwrap() as f64;
        eprintln!("PERF:{} {:.3}ms", label, diff / 1000.0 / 1000.0);
        return res;
    }
    return target_fn();
}

pub fn measure<T, F>(target_fn: &F, label: &str) -> T
where
    F: Fn() -> T,
{
    if crate::ENABLE_PERF {
        let start = Local::now();
        let res = target_fn();
        let diff = (Local::now() - start).num_nanoseconds().unwrap() as f64;
        eprintln!("PERF:{} {:.3}ms", label, diff / 1000.0 / 1000.0);
        return res;
    }
    return target_fn();
}

pub fn nmeasure<T, F>(target_fn: &F, _label: &str) -> T
where
    F: Fn() -> T,
{
    return target_fn();
}

pub fn nmeasure_mut<T, F>(target_fn: &mut F, _label: &str) -> T
where
    F: FnMut() -> T,
{
    return target_fn();
}

#[derive(Debug, EnumIter, Clone)]
pub enum SamplerMarks {
    MainTotal = 0,
    Update = 1,
    Locks = 2,
    Quests = 3,
    Bots = 4,
    Events = 5,
    ShipCleanup = 6,
    MulticastUpdate = 7,
    UpdateLeaderboard = 8,
    UpdatePlanetMovement = 9,
    UpdateAsteroids = 10,
    UpdateShipsOnPlanets = 11,
    UpdateShipsNavigation = 12,
    UpdateShipsTractoring = 13,
    UpdateTractoredMinerals = 14,
    UpdateHpEffects = 15,
    UpdateMineralsRespawn = 16,
    UpdateShipsRespawn = 17,
    UpdatePlanets1 = 18,
    UpdatePlanets2 = 19,
    UpdateRooms = 20,
    UpdateMarket = 21,
    UpdateTickLongActions = 22,
    UpdateTractoredContainers = 23,
    UpdateAbilityCooldowns = 24,
    UpdateAutofocus = 25,
    UpdateShipsManualMovement = 26,
    UpdateInitiateShipsDockingByNavigation = 27,
    UpdateInterpolateDockingShips = 28,
    UpdateTickLongActionsShips = 29,
    StateBroadcast = 30,
    UpdateRuleSpecific = 31,
    ModeCargoRush = 32,
    ModeCargoRushQuests = 33,
    ModePirateDefence = 34,
    BotsPlayers = 35,
    BotsNPCs = 36,
    GenFullSpatialIndexes = 37,
    GenSpatialIndexOnDemand = 38,
    UpdateWreckDecay = 39,
    UpdateEvents = 40
}

impl Display for SamplerMarks {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}
