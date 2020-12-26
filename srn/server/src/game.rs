use crate::vec2::{AsVec2f64, Vec2f64};
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Planet {
    pub id: Uuid,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub radius: f64,
    pub orbit_speed: f64,
    pub anchor_id: Uuid,
    pub anchor_tier: u32,
}

impl AsVec2f64 for Planet {
    fn as_vec(&self) -> Vec2f64 {
        Vec2f64 {
            x: self.x,
            y: self.y,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Star {
    pub id: Uuid,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub radius: f64,
    pub rotation: f64,
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
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameState {
    pub my_id: Uuid,
    pub star: Star,
    pub planets: Vec<Planet>,
    pub ships: Vec<Ship>,
    pub players: Vec<Player>,
    pub tick: u32,
}
