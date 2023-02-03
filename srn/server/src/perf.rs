use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fmt::{Display, Formatter};

use chrono::{DateTime, Local, Timelike};
use itertools::{max, min};
use statistical::standard_deviation;
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use uuid::Uuid;

#[derive(Clone)]
pub struct Sampler {
    buckets: HashMap<u32, Vec<u64>>,
    labels: Vec<String>,
    marks: HashMap<Uuid, (u32, u64)>,
    pub ignore_warning_for_marks: HashSet<u32>,
    empty: bool,
    initial_budget: i32,
    pub budget: i32,
}

// This is important, since there are a lot of performance marks, at one
// point the .mark itself will become the performance problem due to re-allocation
// so this number MUST be higher than the maximum amount of marks an app can produce
// over PERF_CONSUME_TIME
pub const ENTRY_CAPACITY: usize = 1024 * 8 * 8;

#[derive(Clone, Default)]
pub struct ConsumeOptions {
    pub max_mean_ticks: i32,
    pub max_delta_ticks: i32,
    pub max_max: i32,
}

impl Sampler {
    pub fn new(labels: Vec<String>) -> Sampler {
        let mut buckets = HashMap::new();
        Sampler::init_buckets(&labels, &mut buckets);
        Sampler {
            budget: 0,
            labels,
            buckets,
            marks: HashMap::with_capacity(ENTRY_CAPACITY),
            ignore_warning_for_marks: Default::default(),
            empty: false,
            initial_budget: 0,
        }
    }

    pub fn empty() -> Sampler {
        Sampler {
            budget: 0,
            labels: vec![],
            buckets: HashMap::new(),
            marks: HashMap::with_capacity(ENTRY_CAPACITY),
            ignore_warning_for_marks: Default::default(),
            empty: true,
            initial_budget: 0,
        }
    }

    fn init_buckets(labels: &Vec<String>, buckets: &mut HashMap<u32, Vec<u64>>) {
        for i in 0..labels.len() {
            buckets.insert(i as u32, vec![]);
        }
    }

    pub fn add(&mut self, label_idx: u32, val: u64) {
        if self.empty || !*crate::ENABLE_PERF {
            return;
        }
        if let Some(bucket) = self.buckets.get_mut(&label_idx) {
            bucket.push(val);
        } else {
            warn!(format!("Invalid label index {}, no bucket", label_idx));
        }
    }

    pub fn consume(mut self, options: ConsumeOptions) -> (Self, Vec<(String, bool)>) {
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
                    let mean = bucket.iter().sum::<u64>() as f64 / bucket.len() as f64;
                    let std_dev = if f64bucket.len() >= 2 {
                        standard_deviation(&f64bucket, None)
                    } else {
                        0.0
                    };
                    let max = *max(bucket).unwrap_or(&0);
                    let min = *min(bucket).unwrap_or(&0);

                    let mut warning_sign = "";
                    if !self.ignore_warning_for_marks.contains(&(i as u32)) {
                        if options.max_mean_ticks > 0 && mean as i32 > options.max_mean_ticks {
                            warning_sign = "!mean ";
                        } else if options.max_max > 0 && max as i32 > options.max_max {
                            warning_sign = "!max ";
                        } else if options.max_delta_ticks > 0
                            && std_dev as i32 > options.max_delta_ticks
                        {
                            warning_sign = "!delta ";
                        }
                    }
                    result.push((
                        format!(
                            "{}{}(µs):n={} mn={:.2} σ={:.2} max={:.2} min={:.2}",
                            warning_sign,
                            &self.labels[i],
                            bucket.len(),
                            mean,
                            std_dev,
                            max,
                            min,
                        ),
                        warning_sign != "",
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
            let start = Self::get_now().max(0) as u64;
            self.mark(label_idx, start, id);
            id
        } else {
            Default::default()
        };
    }

    fn get_now() -> i64 {
        // this just have to use common reference point, as it will be only used for diffing, not for absolute time
        crate::get_now_nano() as i64
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
                let diff = (Self::get_now() - start as i64).max(0) as u64;
                self.add(label_idx, diff);
                // since marks can be inside each other,
                // subtracting twice might happen for the inside
                // marks
                if top_level {
                    self.budget -= (diff as f64 / 1000.0) as i32;
                }
                if self.budget <= 0 {
                    self.try_finalize_budget();
                }
                return self.budget;
            }
        }
        return res;
    }

    pub fn init_budget(&mut self, value: i32) {
        self.add(SamplerMarks::FrameBudgetTicks as u32, (value * 1000) as u64);
        self.budget = value;
        self.initial_budget = value;
    }

    pub fn try_finalize_budget(&mut self) {
        if self.initial_budget == 0 {
            return;
        }
        let idle = (self.budget as f64) / (self.initial_budget as f64);
        self.add(
            SamplerMarks::FrameIdlePct as u32,
            (idle * 100.0 * 1000.0) as u64,
        );
        self.initial_budget = 0;
    }

    fn mark(&mut self, label_idx: u32, start_nano: u64, id: Uuid) {
        self.marks.insert(id, (label_idx, start_nano));
    }
    fn extract_mark(&self, id: Uuid) -> Option<(u32, u64)> {
        let pair = self.marks.get(&id);
        pair.map(|pair| (pair.0.clone(), pair.1.clone()))
    }
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
    UpdateLocationRadialMovement = 9,
    UpdateSelfRotatingMovement = 10,
    UpdateShipsOnPlanets = 11,
    UpdateShipsNavigation = 12,
    UpdateShipsTractoring = 13,
    UpdateTractoredMinerals = 14,
    UpdateHpEffects = 15,
    UpdateMineralsRespawn = 16,
    UpdateShipsRespawn = 17,
    UpdateRadialMovement = 18,
    RestoreAbsolutePosition = 19,
    UpdateRooms = 20,
    UpdateMarket = 21,
    UpdateTickLongActions = 22,
    UpdateTractoredContainers = 23,
    UpdateAbilityCooldowns = 24,
    UpdateAutofocus = 25,
    UpdateObjectsSpatialMovement = 26,
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
    UpdateEvents = 40,
    UpdateBots = 41,
    UpdateBotsPlayers = 42,
    UpdateBotsNPCs = 43,
    UpdatePlayerActions = 44,
    FrameIdlePct = 45,
    FrameBudgetTicks = 46,
    ApplyReplayDiffBatch = 47,
    ApplyReplayDiff = 48,
    GetDiffReplayStateAtFull = 49,
    GetDiffReplayStateAtPreloaded = 50,
    GetDiffReplayStateAtPreloadedInterpolated = 51,
    UpdateShipHistory = 52,
    EventsLocks = 53,
    EventsCreateRoom = 54,
    UpdateCacheClone = 55,
    UpdateWorldFull = 56,
    UpdateWorldIter = 57,
    UpdateRoomCaches = 58,
    RestoreAbsolutePositionTier1 = 59,
    RestoreAbsolutePositionTier2 = 60,
    RestoreAbsolutePositionTier3 = 61,
    GenRadialBodies = 62,
    UpdateDockedShipsPosition = 63,
    BroadcastState = 64,
    UpdateWorldNonDetIter = 65,
    BroadcastStateDiff = 66,
}

impl Display for SamplerMarks {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}
