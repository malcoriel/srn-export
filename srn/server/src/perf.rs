use chrono::{DateTime, Local};
use itertools::{max, min};
use statistical::standard_deviation;
use std::collections::HashMap;
use uuid::Uuid;

pub struct Sampler {
    buckets: HashMap<u32, Vec<u64>>,
    labels: Vec<String>,
    marks: HashMap<Uuid, (u32, DateTime<Local>)>,
}

impl Sampler {
    pub fn new(labels: Vec<String>) -> Sampler {
        let mut buckets = HashMap::new();
        Sampler::init_buckets(&labels, &mut buckets);
        Sampler {
            labels,
            buckets,
            marks: HashMap::new(),
        }
    }

    fn init_buckets(labels: &Vec<String>, buckets: &mut HashMap<u32, Vec<u64>>) {
        for i in 0..labels.len() {
            buckets.insert(i as u32, vec![]);
        }
    }

    pub fn add(&mut self, label_idx: u32, val: u64) {
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
                result.push(format!(
                    "{}(µs):n={} mn={:.2} σ={:.2} max={:.2} min={:.2}",
                    &self.labels[i],
                    bucket.len(),
                    bucket.iter().sum::<u64>() as f64 / bucket.len() as f64,
                    standard_deviation(&f64bucket, None),
                    max(bucket).unwrap(),
                    min(bucket).unwrap(),
                ));
            }
            self.marks.clear();
            self.buckets.clear();
            Sampler::init_buckets(&self.labels, &mut self.buckets);
        }
        (self, result)
    }

    pub fn start(&mut self, label_idx: u32) -> Uuid {
        let id = if crate::ENABLE_PERF {
            let id = crate::new_id();
            let start = Local::now();
            self.mark(label_idx, start, id);
            id
        } else {
            Default::default()
        };
        return id;
    }

    pub fn end(&mut self, id: Uuid) {
        if crate::ENABLE_PERF {
            if let Some((label_idx, start)) = self.extract_mark(id) {
                let diff = (Local::now() - start).num_nanoseconds().unwrap() as f64;
                self.add(label_idx, diff as u64);
            } else {
                warn!(format!("non"))
            }
        }
    }

    pub fn measure<T, F>(&mut self, target_fn: &F, label_idx: u32) -> T
    where
        F: Fn() -> T,
    {
        if crate::ENABLE_PERF {
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
        if crate::ENABLE_PERF {
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
