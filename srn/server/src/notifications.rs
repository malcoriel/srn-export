use crate::dialogue_dto::Substitution;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum Notification {
    Unknown,
    Help { text: NotificationText, id: Uuid },
    Task { text: NotificationText, id: Uuid },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct NotificationText {
    pub text: String,
    pub substitutions: Vec<Substitution>,
}

// #[wasm_bindgen]
// pub fn is_notification_dismissable(_not: Notification) -> bool {
//     return false;
// }
