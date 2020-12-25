use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Planet {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Ship {
    pub id: Uuid,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Player {
    pub id: Uuid,
    pub ship_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameState {
    pub my_id: Uuid,
    pub planets: Vec<Planet>,
    pub ships: Vec<Ship>,
    pub players: Vec<Player>,
    pub tick: u32,
}
