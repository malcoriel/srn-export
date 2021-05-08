use wasm_bindgen::prelude::*;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use uuid::Uuid;
use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongAction {
    Unknown,
    TransSystemJump {
        to: Uuid
    }
}
