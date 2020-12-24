use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Planet {
    pub id: u64,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Ship {
    pub id: u64,
    pub x: f64,
    pub y: f64,
    pub rot: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameState {
    pub planets: Vec<Planet>,
    pub ships: Vec<Ship>,
}
