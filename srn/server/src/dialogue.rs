use crate::world::{GameState, Planet, PlayerId};
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use std::slice::Iter;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
enum DialogueSubstitutionType {
    Unknown,
    PlanetName,
    CharacterName,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueSubstitution {
    s_type: DialogueSubstitutionType,
    text: String,
    color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueElem {
    text: String,
    id: Uuid,
    substitution: Vec<DialogueSubstitution>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dialogue {
    id: Uuid,
    options: Vec<DialogueElem>,
    prompt: DialogueElem,
    planet: Option<Planet>,
    left_character_url: String,
    right_character_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueUpdate {
    dialogue_id: DialogueId,
    option_id: OptionId,
}

pub type DialogueStates = HashMap<PlayerId, HashMap<DialogueId, Box<Option<StateId>>>>;
pub type DialogueId = Uuid;
pub type StateId = Uuid;
pub type OptionId = Uuid;
pub struct DialogueScript {
    pub transitions: HashMap<(StateId, OptionId), StateId>,
    pub prompts: HashMap<StateId, String>,
    pub options: HashMap<StateId, Vec<(OptionId, String)>>,
}

impl DialogueScript {
    pub fn new() -> Self {
        DialogueScript {
            transitions: Default::default(),
            prompts: Default::default(),
            options: Default::default(),
        }
    }
}

pub type DialogueTable = HashMap<DialogueId, DialogueScript>;

pub fn execute_dialog_option(
    client_id: &Uuid,
    // for state mutation due to dialogue, e.g. updating quest. you need to return the second return arg
    _state: &mut GameState,
    update: DialogueUpdate,
    dialogue_states: &mut DialogueStates,
    dialogue_table: &DialogueTable,
) -> (Option<Dialogue>, bool) {
    if let Some(all_dialogues) = dialogue_states.get_mut(client_id) {
        if let Some(dialogue_state) = all_dialogues.get_mut(&update.dialogue_id) {
            *dialogue_state =
                apply_dialogue_option(dialogue_state.clone(), &update, dialogue_table);
            return (
                build_dialogue_from_state(&update.dialogue_id, dialogue_state, dialogue_table),
                false,
            );
        } else {
            return (None, false);
        }
    } else {
        return (None, false);
    }
}

fn build_dialogue_from_state(
    dialogue_id: &DialogueId,
    current_state: &mut Box<Option<StateId>>,
    dialogue_table: &DialogueTable,
) -> Option<Dialogue> {
    let script = dialogue_table.get(dialogue_id);
    if let Some(script) = script {
        if let Some(state) = **current_state {
            let prompt = script.prompts.get(&state).unwrap();
            let options = script.options.get(&state).unwrap();
            let result = Dialogue {
                id: dialogue_id.clone(),
                options: options
                    .clone()
                    .into_iter()
                    .map(|(id, text)| DialogueElem {
                        text,
                        id,
                        substitution: vec![],
                    })
                    .collect::<Vec<_>>(),
                prompt: DialogueElem {
                    text: prompt.clone(),
                    // prompt id does not matter since it cannot be selected as action
                    id: Default::default(),
                    substitution: vec![],
                },
                planet: None,
                left_character_url: "LEFT_URL".to_string(),
                right_character_url: "RIGHT_URL".to_string(),
            };
            return Some(result);
        }
    }
    return None;
}

fn apply_dialogue_option(
    current_state: Box<Option<StateId>>,
    update: &DialogueUpdate,
    dialogue_table: &DialogueTable,
) -> Box<Option<StateId>> {
    let current_state = *current_state;
    let script = dialogue_table.get(&update.dialogue_id);
    if let Some(script) = script {
        if let Some(current_state) = current_state {
            let next_state = script.transitions.get(&(current_state, update.option_id));
            if let Some(next_state) = next_state {
                return Box::new(Some(next_state.clone()));
            } else {
                return Box::new(None);
            }
        } else {
            return Box::new(None);
        }
    } else {
        return Box::new(None);
    }
}
