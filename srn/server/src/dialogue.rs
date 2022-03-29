use std::borrow::BorrowMut;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::ops::Deref;
use std::slice::Iter;

use itertools::Itertools;

use rand_pcg::Pcg64Mcg;
use rand::prelude::*;
use regex::Regex;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use wasm_bindgen::prelude::*;
use crate::cargo_rush::{CargoDeliveryQuestState, generate_random_quest};
use crate::indexing::{
    find_my_player, find_my_player_mut, find_my_ship, find_my_ship_index, find_my_ship_mut,
    find_planet, find_player_and_ship, find_player_and_ship_mut, find_player_idx,
    index_planets_by_id,
};
use crate::inventory::{
    add_item, consume_items_of_types, count_items_of_types, InventoryItem,
    InventoryItemType, MINERAL_TYPES, remove_quest_item, value_items_of_types,
};
use crate::{prng_id, seed_prng};
use crate::perf::Sampler;
use crate::random_stuff::gen_random_character_name;
use crate::substitutions::{index_state_for_substitution, substitute_text};
use crate::world::{fire_saved_event, GameState, Planet, Player, PlayerId, Ship};
use crate::world_events::GameEvent;
use crate::{fire_event, world};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueUpdate {
    pub dialogue_id: Uuid,
    pub option_id: Uuid,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct DialogueTable {
    pub scripts: HashMap<DialogueId, DialogueScript>,
}

pub type DialogueState = Box<Option<StateId>>;

pub type DialogueStatesForPlayer = (Option<DialogueId>, HashMap<DialogueId, DialogueState>);

// player -> (activeDialogue?, dialogue -> state?)
pub type DialogueStates = HashMap<PlayerId, DialogueStatesForPlayer>;
pub type DialogueId = Uuid;
pub type StateId = Uuid;
pub type OptionId = Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum DialogueOptionSideEffect {
    Nothing,
    Undock,
    QuestCargoPickup,
    QuestCargoDropOff,
    QuestCollectReward,
    SellMinerals,
    QuitTutorial,
    SwitchDialogue(String),
    TriggerTutorialQuest,
    TriggerTrade,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub enum TriggerCondition {
    CurrentPlanetIsPickup,
    CurrentPlanetIsDropoff,
    AnyMineralsInCargo,
}

pub fn check_trigger_conditions(state: &GameState, player_id: Uuid) -> HashSet<TriggerCondition> {
    let mut res = HashSet::new();
    if let (Some(player), Some(ship)) = find_player_and_ship(state, player_id) {
        if let Some(planet) = find_current_planet(player, state) {
            if let Some(quest) = player.quest.clone() {
                if quest.from_id == planet.id && quest.state == CargoDeliveryQuestState::Started {
                    res.insert(TriggerCondition::CurrentPlanetIsPickup);
                } else if quest.to_id == planet.id && quest.state == CargoDeliveryQuestState::Picked
                {
                    res.insert(TriggerCondition::CurrentPlanetIsDropoff);
                }
            }
        }

        if count_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec()) > 0 {
            res.insert(TriggerCondition::AnyMineralsInCargo);
        }
    }
    res
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueScript {
    pub id: Uuid,
    pub transitions: HashMap<(StateId, OptionId), (Option<StateId>, Vec<DialogueOptionSideEffect>)>,
    pub prompts: HashMap<StateId, String>,
    pub options: HashMap<StateId, Vec<(OptionId, String, Option<TriggerCondition>)>>,
    pub initial_state: StateId,
    pub is_planetary: bool,
    pub portrait: String,
    pub priority: i32,
    pub is_default: bool,
    pub name: String,
    pub bot_path: Vec<(StateId, OptionId, Option<TriggerCondition>)>,
    pub names_db: HashMap<Uuid, String>,
    ids_db: HashMap<String, Uuid>,
}

impl DialogueScript {
    pub fn new() -> Self {
        DialogueScript {
            id: Default::default(),
            transitions: Default::default(),
            prompts: Default::default(),
            options: Default::default(),
            initial_state: Default::default(),
            is_planetary: false,
            is_default: false,
            priority: 0,
            name: "no name".to_string(),
            bot_path: Default::default(),
            names_db: Default::default(),
            ids_db: Default::default(),
            portrait: "question".to_string(),
        }
    }
    pub fn get_name(&self, id: Uuid) -> &String {
        return self.names_db.get(&id).unwrap();
    }
    pub fn get_next_bot_path(
        &self,
        current_state: &Option<StateId>,
        game_state: &GameState,
        player_id: Uuid,
    ) -> Option<&OptionId> {
        let current_conditions = check_trigger_conditions(game_state, player_id);
        if current_state.is_none() {
            return None;
        }
        let current_state = current_state.unwrap();

        for (state_id, option_id, condition) in self.bot_path.iter() {
            if *state_id == current_state {
                if let Some(condition) = condition {
                    if current_conditions.contains(&condition) {
                        return Some(&option_id);
                    }
                } else {
                    return Some(&option_id);
                }
            }
        }
        warn!("no next bot path found");
        return None;
    }
    pub fn check_player(
        &self,
        game_state: &GameState,
        player: &Player,
        _d_state: Option<&DialogueState>,
    ) -> bool {
        /*
        Ideally, this should be remade into a trigger system like this:
        "trigger": {
            "event": "Dock",
            "conditions": ["CargoDeliveryQuestState = Started", "s_cargo_destination_planet = s_current_planet"]
        }
        in dialogue.json
        */
        if self.is_planetary {
            if let Some(current_planet_id) = find_current_planet(&player, game_state).map(|p| p.id)
            {
                if self.is_default {
                    return true;
                }

                if let Some(quest) = player.quest.as_ref() {
                    let is_planet_current = {
                        let res = if quest.state == CargoDeliveryQuestState::Started
                            && self.name == "cargo_delivery_pickup"
                        {
                            quest.from_id == current_planet_id
                        } else if quest.state == CargoDeliveryQuestState::Picked
                            && self.name == "cargo_delivery_dropoff"
                        {
                            quest.to_id == current_planet_id
                        } else {
                            false
                        };
                        res
                    };

                    return is_planet_current;
                }
            }
        }
        return false;
    }
}

fn find_current_planet<'a, 'b>(
    player: &'a Player,
    game_state: &'b GameState,
) -> Option<&'b Planet> {
    let ship = find_my_ship(game_state, player.id);
    ship.and_then(|s| s.docked_at)
        .and_then(|id| find_planet(game_state, &id))
}

impl DialogueTable {
    pub fn new() -> DialogueTable {
        return DialogueTable {
            scripts: Default::default(),
        };
    }
    pub fn get_by_name(&self, name: &str) -> Option<&DialogueScript> {
        for script in self.scripts.values() {
            if script.name == name {
                return Some(script);
            }
        }
        return None;
    }

    pub fn trigger_dialogue(
        &self,
        script: &DialogueScript,
        player_id: Uuid,
        game_state: &mut GameState,
    ) {
        let player_d_states = DialogueTable::get_player_d_states(&mut game_state.dialogue_states, player_id);
        player_d_states.insert(script.id, Box::new(Some(script.initial_state)));
    }

    pub fn get_player_d_states(
        d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
        player_id: Uuid,
    ) -> &mut HashMap<Uuid, Box<Option<Uuid>>> {
        let (_current_player_dialogue, player_d_states) =
            d_states.entry(player_id).or_insert((None, HashMap::new()));
        player_d_states
    }

    pub fn get_player_d_states_read(
        d_states: &HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
        player_id: Uuid,
    ) -> Option<&HashMap<Uuid, Box<Option<Uuid>>>> {
        if let Some((_curr, all)) =
            d_states.get(&player_id) {
            return Some(all);
        }
        return None;
    }
}

pub fn execute_dialog_option(
    player_id: Uuid,
    state: &mut GameState,
    update: DialogueUpdate,
    dialogue_table: &DialogueTable,
    prng: &mut Pcg64Mcg,
) {
    let player_d_states = state.dialogue_states.get(&player_id).map(|v| (*v).clone());
    if let Some(all_dialogues) = player_d_states {
        if let Some(dialogue_state) = all_dialogues.1.get(&update.dialogue_id) {
            // let script = dialogue_table.scripts.get(&update.dialogue_id).unwrap();
            // log!(format!("before applying, states are {:?}", state.dialogue_states.get(&player_id)));
            // log!(format!("t-ms {} player {} dialogue {:?} current state {:?} execute option {:?}", state.millis, player_id, script.name, script.names_db.get(&dialogue_state.clone().deref().unwrap()), script.names_db.get(&update.option_id)));
            apply_dialogue_option(
                Box::new(*dialogue_state.clone().deref()),
                &update,
                dialogue_table,
                state,
                player_id,
                prng,
            );
            // log!(format!("after applying, states are {:?}", state.dialogue_states.get(&player_id)));
        }
        else {
            log!(format!("no state for dialogue for {} in {:?}", player_id, all_dialogues));
        }
    } else {
        log!("not state for player");
    }
}

pub fn build_dialogue_from_state(
    dialogue_id: DialogueId,
    current_state: &Box<Option<StateId>>,
    dialogue_table: &DialogueTable,
    player_id: PlayerId,
    game_state: &GameState
) -> Option<Dialogue> {
    let (planets_by_id, players_by_id, players_to_current_planets, ships_by_player_id, _) =
        index_state_for_substitution(game_state);

    let satisfied_conditions = check_trigger_conditions(game_state, player_id);
    let script = dialogue_table.scripts.get(&dialogue_id);
    let player = find_my_player(game_state, player_id);
    if let Some(script) = script {
        let mut prng = seed_prng(script.name.clone() + game_state.id.to_string().as_str());
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

            let (subs, prompt) = substitute_text(
                &prompt,
                player_id,
                &players_to_current_planets,
                &players_by_id,
                &planets_by_id,
                &ships_by_player_id,
            );

            let prompt = DialogueElem {
                text: prompt,
                id: prng_id(&mut prng),
                is_option: false,
                substitution: subs,
            };
            let result = Dialogue {
                id: dialogue_id.clone(),
                options: build_dialogue_options(
                    player_id,
                    &planets_by_id,
                    &players_by_id,
                    &players_to_current_planets,
                    &ships_by_player_id,
                    satisfied_conditions,
                    options,
                ),
                prompt,
                planet: current_planet,
                left_character: format!("{}", {
                    player.map_or("question.png".to_string(), |p| {
                        format!("{}", p.portrait_name)
                    })
                }),
                right_character: script.portrait.clone(),
            };
            return Some(result);
        }
    }
    return None;
}

//noinspection RsTypeCheck
fn build_dialogue_options(
    player_id: Uuid,
    planets_by_id: &HashMap<Uuid, &Planet>,
    players_by_id: &HashMap<Uuid, &Player>,
    players_to_current_planets: &HashMap<Uuid, &Planet>,
    ships_by_player_id: &HashMap<Uuid, &Ship>,
    satisfied_conditions: HashSet<TriggerCondition>,
    options: &Vec<(Uuid, String, Option<TriggerCondition>)>,
) -> Vec<DialogueElem> {
    options
        .clone()
        .into_iter()
        .filter_map(|(id, text, condition)| {
            if let Some(condition) = condition {
                if satisfied_conditions.contains(&condition) {
                    let (subs, text) = substitute_text(
                        &text,
                        player_id,
                        &players_to_current_planets,
                        &players_by_id,
                        &planets_by_id,
                        &ships_by_player_id,
                    );

                    Some(DialogueElem {
                        substitution: subs,
                        text,
                        id,
                        is_option: true,
                    })
                } else {
                    None
                }
            } else {
                let (subs, text) = substitute_text(
                    &text,
                    player_id,
                    &players_to_current_planets,
                    &players_by_id,
                    &planets_by_id,
                    &ships_by_player_id,
                );
                Some(DialogueElem {
                    substitution: subs,
                    text,
                    id,
                    is_option: true,
                })
            }
        })
        .collect::<Vec<_>>()
}

fn apply_dialogue_option(
    current_state: DialogueState,
    update: &DialogueUpdate,
    dialogue_table: &DialogueTable,
    state: &mut GameState,
    player_id: PlayerId,
    prng: &mut Pcg64Mcg,
) {
    let script = dialogue_table.scripts.get(&update.dialogue_id);
    if let Some(script) = script {
        if let Some(current_state) = *current_state {
            // eprintln!("apply current_state update {:?}", (current_state, update));
            let next_state = script.transitions.get(&(current_state, update.option_id));
            if let Some(next_state) = next_state {
                apply_side_effects(state, next_state.1.clone(), player_id, prng);
                let player_states = DialogueTable::get_player_d_states(&mut state.dialogue_states, player_id).entry(update.dialogue_id).or_insert(Box::new(None));
                *player_states = Box::new(next_state.0);
            } else {
                warn!("invalid dialogue transition, no outcome");
            }
        }
    };
}

//noinspection RsUnresolvedReference
fn apply_side_effects(
    state: &mut GameState,
    side_effects: Vec<DialogueOptionSideEffect>,
    player_id: PlayerId,
    prng: &mut Pcg64Mcg,
) -> bool {
    let mut state_changed = false;
    let player = find_my_player(state, player_id);
    if player.is_none() {
        warn!("side effects without player");
    }
    let player_idx = find_player_idx(state, player_id);
    for side_effect in side_effects {
        match side_effect {
            DialogueOptionSideEffect::Nothing => {}
            DialogueOptionSideEffect::Undock => {
                let my_ship_idx = find_my_ship_index(state, player_id);
                if let Some(my_ship_idx) = my_ship_idx {
                    world::undock_ship(state, my_ship_idx, false, player_idx, prng);
                    state_changed = true;
                }
            }
            DialogueOptionSideEffect::QuestCargoPickup => {
                if let (Some(my_player), Some(ship)) = find_player_and_ship_mut(state, player_id) {
                    let quest = my_player.quest.as_mut();
                    if let Some(mut quest) = quest {
                        quest.state = CargoDeliveryQuestState::Picked;
                        add_item(&mut ship.inventory, InventoryItem::quest_pickup(quest.id));
                    }
                    state_changed = true;
                }
            }
            DialogueOptionSideEffect::QuestCargoDropOff => {
                if let (Some(my_player), Some(ship)) = find_player_and_ship_mut(state, player_id) {
                    if let Some(mut quest) = my_player.quest.as_mut() {
                        quest.state = CargoDeliveryQuestState::Delivered;
                        remove_quest_item(&mut ship.inventory, quest.id);
                    }
                    state_changed = true;
                }
            }
            DialogueOptionSideEffect::QuestCollectReward => {
                if let Some(mut my_player) = find_my_player_mut(state, player_id) {
                    if let Some(mut quest) = my_player.quest.as_mut() {
                        quest.state = CargoDeliveryQuestState::Delivered;
                        my_player.money += quest.reward;
                        my_player.quest = None;
                    }
                    state_changed = true;
                }
            }
            DialogueOptionSideEffect::SellMinerals => {
                let (player, ship) = find_player_and_ship_mut(state, player_id);
                if let (Some(player), Some(ship)) = (player, ship) {
                    let minerals =
                        consume_items_of_types(&mut ship.inventory, &MINERAL_TYPES.to_vec());
                    let sum = minerals
                        .iter()
                        .fold(0, |acc, curr| acc + curr.value * curr.quantity);
                    player.money += sum;
                }
            }
            DialogueOptionSideEffect::SwitchDialogue(name) => {
                // this pattern leads to `warn(mutable_borrow_reservation_conflict)`, hence strange separation
                let player_clone = if let Some(player) = find_my_player(state, player_id) {
                    Some(player.clone())
                } else {
                    None
                };
                if let Some(player_clone) = player_clone {
                    fire_saved_event(
                        state,
                        GameEvent::DialogueTriggerRequest {
                            dialogue_name: name,
                            player_id: player_clone.id,
                        },
                    )
                }
            }
            DialogueOptionSideEffect::QuitTutorial => {
                fire_event(GameEvent::QuitPlayerRequest { player_id })
            }
            DialogueOptionSideEffect::TriggerTutorialQuest => {
                if let Some(player) = find_my_player(state, player_id) {
                    fire_event(GameEvent::CargoQuestTriggerRequest {
                        player_id: player.id,
                    })
                }
            }
            DialogueOptionSideEffect::TriggerTrade => {
                let find_result = find_player_and_ship(state, player_id);
                let player_clone = find_result.0.map(|v| v.clone());
                let ship_clone = find_result.1.map(|v| v.clone());
                if let (Some(player), Some(ship)) = (player_clone, ship_clone) {
                    if ship.docked_at.is_some() {
                        fire_saved_event(state, GameEvent::TradeDialogueTriggerRequest {
                            player_id: player.id,
                            ship_id: ship.id,
                            planet_id: ship.docked_at.unwrap(),
                        })
                    }
                }
            }
        }
    }
    return state_changed;
}

pub fn gen_scripts() -> Vec<DialogueScript> {
    let mut res = vec![];
    res.push(read_from_resource("basic_planet"));
    res.push(read_from_resource("cargo_delivery_pickup"));
    res.push(read_from_resource("cargo_delivery_dropoff"));
    res.push(read_from_resource("tutorial_start"));
    res.push(read_from_resource("tutorial_camera"));
    res.push(read_from_resource("tutorial_movement"));
    res.push(read_from_resource("tutorial_quests"));
    res.push(read_from_resource("tutorial_end"));
    res
}

pub fn read_from_resource(file: &str) -> DialogueScript {
    let json = fs::read_to_string(format!("resources/dialogue_scripts/{}.json", file))
        .expect("script not found");
    parse_dialogue_script_from_file(file, json)
}

pub fn parse_dialogue_script_from_file(
    file_name: &str,
    json_contents: String,
) -> DialogueScript {
    let seed = file_name.to_string();
    let mut prng = seed_prng(seed.clone());

    let result = serde_json::from_str::<ShortScript>(json_contents.as_str());
    if result.is_err() {
        panic!(
            "Failed to load dialogue script {}, err is {:?}",
            file_name,
            result.err()
        );
    }
    short_decrypt(result.unwrap(), &mut prng)
}

// option_name, option_text, new_state_name, side_effects, option_condition_name
pub type ShortScriptLine = (
    String,
    String,
    String,
    Vec<DialogueOptionSideEffect>,
    Option<TriggerCondition>,
);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShortScript {
    pub name: String,
    pub is_default: bool,
    pub is_planetary: bool,
    pub priority: i32,
    pub initial_state_name: String,
    pub portrait: Option<String>,
    pub environment: Option<String>,
    pub table: HashMap<String, (String, Vec<ShortScriptLine>)>,
    // [[state_name, option_name, condition_for_choosing_it]]
    pub bot_path: Vec<(String, String, Option<TriggerCondition>)>,
}

pub fn short_decrypt(ss: ShortScript, prng: &mut Pcg64Mcg) -> DialogueScript {
    println!("loading {} dialogue...", ss.name);
    let mut script = DialogueScript::new();
    script.id = prng_id(prng);
    script.is_default = ss.is_default;
    script.is_planetary = ss.is_planetary;
    script.priority = ss.priority;
    script.portrait = ss.portrait.unwrap_or("question".to_string());

    for (state_name, (state_prompt, options)) in ss.table.iter() {
        let state_id = prng_id(prng);
        if ss.initial_state_name == *state_name {
            script.initial_state = state_id;
        }
        script.names_db.insert(state_id, state_name.clone());
        script.ids_db.insert(state_name.clone(), state_id);
        script.prompts.insert(state_id, state_prompt.clone());

        for (option_name, _, _, _, _) in options.into_iter() {
            let option_id = prng_id(prng);
            script.names_db.insert(option_id, option_name.clone());
            script.ids_db.insert(option_name.clone(), option_id);
        }
    }

    for (state_name, (_, options)) in ss.table.into_iter() {
        let state_id = script.ids_db.get(&state_name).unwrap().clone();
        for (option_name, option_text, next_state_name, side_effects, option_condition) in
        options.into_iter()
        {
            let option_id = script.ids_db.get(&option_name).unwrap().clone();
            let next_state_id = if next_state_name != "" {
                let option = script.ids_db.get(&next_state_name);
                option.expect(format!("no next state by name {}", next_state_name).as_str());
                Some(option.unwrap().clone())
            } else {
                None
            };
            script
                .transitions
                .insert((state_id, option_id), (next_state_id, side_effects));
            let current_opts = script.options.entry(state_id).or_insert(vec![]);
            current_opts.push((option_id, option_text, option_condition));
        }
    }

    for (state_name, option_name, condition) in ss.bot_path {
        let option_id = script.ids_db.get(&option_name).unwrap().clone();
        let state_id = script.ids_db.get(&state_name).unwrap().clone();
        script.bot_path.push((state_id, option_id, condition));
    }
    script.name = ss.name;
    script
}

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
