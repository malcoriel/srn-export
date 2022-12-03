use std::collections::HashMap;
use std::mem;

use crate::dialogue::DialogueTable;
use crate::indexing::GameStateCaches;
use crate::DIALOGUE_TABLE;
use rocket::http::Status;
use rocket_contrib::json::Json;
use uuid::Uuid;

#[get("/dialogue_scripts")]
pub fn get_dialogue_scripts() -> Json<DialogueTable> {
    let table = { DIALOGUE_TABLE.lock().unwrap().clone() };
    Json(*table)
}
