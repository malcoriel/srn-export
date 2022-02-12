use rocket_contrib::json::Json;
use uuid::Uuid;
use crate::new_id;
use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ReplayListItem {
    id: Uuid,
    name: String
}

#[get("/")]
pub fn get_saved_replays() -> Json<Vec<ReplayListItem>> {
    Json(vec![ReplayListItem {
        id: new_id(),
        name: "test".to_string()
    }])
}
