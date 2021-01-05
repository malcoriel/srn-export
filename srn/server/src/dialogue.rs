use crate::new_id;
use crate::world::{
    find_my_player, find_my_ship, find_my_ship_mut, find_planet, GameState, Planet, PlayerId,
};
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use std::slice::Iter;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
enum DialogueSubstitutionType {
    Unknown,
    PlanetName,
    CharacterName,
    Generic,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueSubstitution {
    s_type: DialogueSubstitutionType,
    id: Uuid,
    text: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueElem {
    text: String,
    id: Uuid,
    substitution: Vec<DialogueSubstitution>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Dialogue {
    pub id: Uuid,
    pub options: Vec<DialogueElem>,
    pub prompt: DialogueElem,
    pub planet: Option<Planet>,
    pub left_character_url: String,
    pub right_character_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueUpdate {
    pub dialogue_id: Uuid,
    pub option_id: Uuid,
}

// player -> (activeDialogue?, dialogue -> state?)
pub type DialogueStates = HashMap<
    PlayerId,
    (
        Option<DialogueId>,
        HashMap<DialogueId, Box<Option<StateId>>>,
    ),
>;
pub type DialogueId = Uuid;
pub type StateId = Uuid;
pub type OptionId = Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum DialogOptionSideEffect {
    Nothing,
    Undock,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueScript {
    pub transitions: HashMap<(StateId, OptionId), (Option<StateId>, DialogOptionSideEffect)>,
    pub prompts: HashMap<StateId, String>,
    pub options: HashMap<StateId, Vec<(OptionId, String)>>,
    pub initial_state: StateId,
    pub is_planetary: bool,
}

impl DialogueScript {
    pub fn new() -> Self {
        DialogueScript {
            transitions: Default::default(),
            prompts: Default::default(),
            options: Default::default(),
            initial_state: Default::default(),
            is_planetary: false,
        }
    }
}

pub type DialogueTable = HashMap<DialogueId, DialogueScript>;

pub fn execute_dialog_option(
    client_id: &Uuid,
    // for state mutation due to dialogue, e.g. updating quest. you need to return the second return arg
    state: &mut GameState,
    update: DialogueUpdate,
    dialogue_states: &mut DialogueStates,
    dialogue_table: &DialogueTable,
) -> (Option<Dialogue>, bool) {
    if let Some(all_dialogues) = dialogue_states.get_mut(client_id) {
        if let Some(dialogue_state) = all_dialogues.1.get_mut(&update.dialogue_id) {
            let (new_state, side_effect) = apply_dialogue_option(
                dialogue_state.clone(),
                &update,
                dialogue_table,
                state,
                &client_id,
            );
            *dialogue_state = new_state;
            return (
                build_dialogue_from_state(
                    &update.dialogue_id,
                    dialogue_state,
                    dialogue_table,
                    client_id,
                    state,
                ),
                side_effect,
            );
        } else {
            return (None, false);
        }
    } else {
        return (None, false);
    }
}

pub fn build_dialogue_from_state(
    dialogue_id: &DialogueId,
    current_state: &Box<Option<StateId>>,
    dialogue_table: &DialogueTable,
    player_id: &PlayerId,
    game_state: &GameState,
) -> Option<Dialogue> {
    let script = dialogue_table.get(dialogue_id);
    if let Some(script) = script {
        if let Some(state) = **current_state {
            let prompt = script.prompts.get(&state).unwrap();
            let options = script.options.get(&state).unwrap();
            let current_planet = if script.is_planetary {
                let my_ship = find_my_ship(game_state, player_id);
                my_ship
                    .and_then(|s| s.docked_at)
                    .and_then(|p| find_planet(game_state, &p))
                    .and_then(|p| Some(p.clone()))
            } else {
                None
            };
            let result = Dialogue {
                id: dialogue_id.clone(),
                options: options
                    .clone()
                    .into_iter()
                    .map(|(id, text)| DialogueElem {
                        substitution: substitute_text(&text, &current_planet),
                        text,
                        id,
                    })
                    .collect::<Vec<_>>(),
                prompt: DialogueElem {
                    text: prompt.clone(),
                    // prompt id does not matter since it cannot be selected as action
                    id: Default::default(),
                    substitution: substitute_text(&prompt, &current_planet),
                },
                planet: current_planet,
                left_character_url: format!("resources/chars/{}", {
                    let player = find_my_player(game_state, player_id);
                    player.map_or("question.png".to_string(), |p| {
                        format!("{}.jpg", p.photo_id)
                    })
                }),
                right_character_url: format!("resources/chars/question.png"),
            };
            return Some(result);
        }
    }
    return None;
}

use regex::Regex;

fn substitute_text(text: &String, current_planet: &Option<Planet>) -> Vec<DialogueSubstitution> {
    let mut res = vec![];
    let re = Regex::new(r"s_\w+").unwrap();
    for cap in re.captures_iter(text.as_str()) {
        if cap[0] == *"s_current_planet" {
            if let Some(current_planet) = current_planet {
                res.push(DialogueSubstitution {
                    s_type: DialogueSubstitutionType::PlanetName,
                    id: current_planet.id,
                    text: current_planet.name.clone(),
                })
            } else {
                eprintln!("s_current_planet used without current planet");
            }
        } else if cap[0] == *"s_current_planet_body_type" {
            if let Some(current_planet) = current_planet {
                res.push(DialogueSubstitution {
                    s_type: DialogueSubstitutionType::Generic,
                    id: current_planet.id,
                    text: (if current_planet.anchor_tier == 1 {
                        "planet"
                    } else {
                        "moon"
                    })
                    .to_string(),
                });
            } else {
                eprintln!("s_current_planet used without current planet");
            }
        } else {
            eprintln!("Unknown substitution {}", cap[0].to_string());
        }
    }
    res
}

fn apply_dialogue_option(
    current_state: Box<Option<StateId>>,
    update: &DialogueUpdate,
    dialogue_table: &DialogueTable,
    state: &mut GameState,
    player_id: &PlayerId,
) -> (Box<Option<StateId>>, bool) {
    // eprintln!("apply start");

    let current_state = *current_state;
    let script = dialogue_table.get(&update.dialogue_id);
    return if let Some(script) = script {
        if let Some(current_state) = current_state {
            // eprintln!("apply current_state update {:?}", (current_state, update));
            let next_state = script.transitions.get(&(current_state, update.option_id));
            // eprintln!("apply next state {:?}", next_state);
            if let Some(next_state) = next_state {
                let side_effect = apply_side_effect(state, next_state.1.clone(), player_id);
                (Box::new(next_state.0.clone()), side_effect)
            } else {
                (Box::new(None), false)
            }
        } else {
            (Box::new(None), false)
        }
    } else {
        (Box::new(None), false)
    };
}

fn apply_side_effect(
    state: &mut GameState,
    side_effect: DialogOptionSideEffect,
    player_id: &PlayerId,
) -> bool {
    match side_effect {
        DialogOptionSideEffect::Nothing => {}
        DialogOptionSideEffect::Undock => {
            let my_ship = find_my_ship_mut(state, player_id);
            if let Some(my_ship) = my_ship {
                my_ship.docked_at = None;
                return true;
            }
        }
    }
    return false;
}

pub fn gen_basic_planet_script() -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, DialogueScript) {
    let dialogue_id = new_id();
    let arrival = new_id();
    let market = new_id();
    let go_market = new_id();
    let go_back = new_id();
    let go_exit = new_id();

    let mut script = DialogueScript {
        transitions: Default::default(),
        prompts: Default::default(),
        options: Default::default(),
        initial_state: Default::default(),
        is_planetary: true,
    };
    script.initial_state = arrival;
    script
        .prompts
        .insert(arrival, "You have landed on the s_current_planet_body_type s_current_planet. The space port is buzzing with activity, but there's nothing of interest here for you.".to_string());
    script
        .prompts
        .insert(market, "You come to the marketplace on s_current_planet, but suddenly realize that you forgot your wallet on the ship! So there is nothing here for you. Maybe there will be something in the future?".to_string());
    script.transitions.insert(
        (arrival, go_market),
        (Some(market), DialogOptionSideEffect::Nothing),
    );
    script.transitions.insert(
        (market, go_back),
        (Some(arrival), DialogOptionSideEffect::Nothing),
    );
    script
        .transitions
        .insert((arrival, go_exit), (None, DialogOptionSideEffect::Undock));
    script
        .transitions
        .insert((market, go_exit), (None, DialogOptionSideEffect::Undock));
    script.options.insert(
        arrival,
        vec![
            (go_market, "Go to the marketplace".to_string()),
            (go_exit, "Undock and fly away".to_string()),
        ],
    );
    script.options.insert(
        market,
        vec![
            (go_back, "Go back to the space port".to_string()),
            (go_exit, "Undock and fly away".to_string()),
        ],
    );
    (
        dialogue_id,
        arrival,
        market,
        go_market,
        go_back,
        go_exit,
        script,
    )
}
