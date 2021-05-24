use uuid::Uuid;

use crate::world::Planet;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub enum SubstitutionType {
    Unknown,
    PlanetName,
    CharacterName,
    Generic,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Substitution {
    pub s_type: SubstitutionType,
    pub id: Uuid,
    pub text: String,
    pub target_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct DialogueElem {
    pub text: String,
    pub id: Uuid,
    pub is_option: bool,
    pub substitution: Vec<Substitution>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Dialogue {
    pub id: Uuid,
    pub options: Vec<DialogueElem>,
    pub prompt: DialogueElem,
    pub planet: Option<Planet>,
    pub left_character: String,
    pub right_character: String,
}
