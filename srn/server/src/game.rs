use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Planet {
    pub id: u64,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Ship {
    pub id: u64,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Player {
    pub id: u64,
    pub ship_id: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameState {
    pub planets: Vec<Planet>,
    pub ships: Vec<Ship>,
    pub players: Vec<Player>,
    pub tick: u32,
}
