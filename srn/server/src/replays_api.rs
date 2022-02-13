use rocket_contrib::json::Json;
use uuid::Uuid;
use crate::{GameMode, GameState, new_id};
use serde_derive::{Deserialize, Serialize};
use crate::system_gen::seed_state;

#[derive(Serialize, Deserialize)]
pub struct ReplayListItem {
    pub id: Uuid,
    pub name: String
}

#[get("/")]
pub fn get_saved_replays() -> Json<Vec<ReplayListItem>> {
    Json(vec![ReplayListItem {
        id: new_id(),
        name: "test".to_string()
    }])
}


#[derive(Serialize, Deserialize)]
pub struct Replay {
    pub initial_state: GameState
}

#[get("/<replay_id>")]
pub fn get_replay_by_id(replay_id: String) -> Json<Replay> {
    Json(Replay {
        initial_state: seed_state(&GameMode::CargoRush, "123".to_string())
    })
}
