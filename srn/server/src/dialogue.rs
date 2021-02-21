use std::borrow::BorrowMut;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::slice::Iter;

use itertools::Itertools;
use regex::Regex;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::fire_event;
use crate::new_id;
use crate::perf::Sampler;
use crate::random_stuff::gen_random_character_name;
use crate::world::{find_my_player, find_my_player_mut, find_my_ship, find_my_ship_mut, find_planet, generate_random_quest, CargoDeliveryQuestState, GameEvent, GameState, Planet, Player, PlayerId, find_player_and_ship_mut, find_player_and_ship};
use crate::inventory::{consume_items_of_types, InventoryItemType, MINERAL_TYPES, count_items_of_types, value_items_of_types, add_item, InventoryItem, remove_quest_item};

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
    pub left_character: String,
    pub right_character: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueUpdate {
    pub dialogue_id: Uuid,
    pub option_id: Uuid,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
pub enum DialogOptionSideEffect {
    Nothing,
    Undock,
    QuestCargoPickup,
    QuestCargoDropOff,
    QuestCollectReward,
    SellMinerals,
    QuitTutorial,
    SwitchDialogue(String),
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
                } else if quest.to_id == planet.id && quest.state == CargoDeliveryQuestState::Picked {
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
    pub transitions: HashMap<(StateId, OptionId), (Option<StateId>, Vec<DialogOptionSideEffect>)>,
    pub prompts: HashMap<StateId, String>,
    pub options: HashMap<StateId, Vec<(OptionId, String, Option<TriggerCondition>)>>,
    pub initial_state: StateId,
    pub is_planetary: bool,
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
        }
    }
    pub fn get_name(&self, id: Uuid) -> &String {
        return self.names_db.get(&id).unwrap();
    }
    pub fn get_next_bot_path(&self, current_state: &Option<StateId>, game_state: &GameState, player_id: Uuid) -> Option<&OptionId> {
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
        res: &mut Vec<(Uuid, Option<Dialogue>)>,
        player: &Player,
        player_d_states: &mut HashMap<Uuid, Box<Option<Uuid>>>,
        game_state: &GameState,
    ) {
        let value = Box::new(Some(script.initial_state));
        res.push((
            player.id,
            build_dialogue_from_state(script.id, &value, self, player.id, game_state),
        ));
        player_d_states.insert(script.id, value);
    }

    pub fn try_trigger(
        &self,
        state: &GameState,
        d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
        mut res: &mut Vec<(Uuid, Option<Dialogue>)>,
        player: &Player,
        sampler: Sampler,
    ) -> Sampler {
        let player_d_states = DialogueTable::get_player_d_states(d_states, player);

        let mut d_script: Option<&DialogueScript> = None;
        for script in self
            .scripts
            .values()
            .sorted_by(|d1, d2| d1.priority.cmp(&d2.priority))
            .rev()
        {
            // eprintln!("checking {}", script.name);
            if script.check_player(state, player, player_d_states.get(&script.id)) {
                d_script = Some(script);
                // eprintln!("catch! {}", script.name);
                break;
            }
        }
        if d_script.is_none() {
            return sampler;
        }

        let d_script = d_script.unwrap();
        let d_id = d_script.id;
        let ship = find_my_ship(state, player.id);
        if let Some(ship) = ship {
            if let Some(_docked_at) = ship.docked_at {
                if !player_d_states.contains_key(&d_id) {
                    self.trigger_dialogue(d_script, &mut res, player, player_d_states, state);
                } else {
                    let existing_state = player_d_states.get(&d_id).unwrap();
                    if existing_state.is_none() {
                        self.trigger_dialogue(
                            d_script,
                            &mut res,
                            player,
                            player_d_states,
                            state,
                        );
                    }
                }
            } else {
                if player_d_states.contains_key(&d_id) {
                    player_d_states.remove(&d_id);
                    res.push((player.id, None))
                }
            }
        }
        sampler
    }

    pub fn get_player_d_states<'a, 'b>(d_states: &'a mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>, player: &'b Player) -> &'a mut HashMap<Uuid, Box<Option<Uuid>>> {
        let (_current_player_dialogue, player_d_states) =
            d_states.entry(player.id).or_insert((None, HashMap::new()));
        player_d_states
    }
}

pub fn execute_dialog_option(
    client_id: Uuid,
    // for state mutation due to dialogue, e.g. updating quest. you need to return the second return arg
    state: &mut GameState,
    update: DialogueUpdate,
    dialogue_states: &mut DialogueStates,
    dialogue_table: &DialogueTable,
) -> (Option<Dialogue>, bool) {
    // bool means "side effect happened, state changed"
    let mut return_value = (None, false);
    let mut should_drop = false;
    if let Some(all_dialogues) = dialogue_states.get_mut(&client_id) {
        if let Some(dialogue_state) = all_dialogues.1.get_mut(&update.dialogue_id) {
            let (new_state, side_effect) = apply_dialogue_option(
                dialogue_state.clone(),
                &update,
                dialogue_table,
                state,
                client_id,
            );
            if new_state.is_none() {
                should_drop = true;
            }
            *dialogue_state = new_state;
            return_value = (
                build_dialogue_from_state(
                    update.dialogue_id,
                    dialogue_state,
                    dialogue_table,
                    client_id,
                    state,
                ),
                side_effect,
            );
        }
        if should_drop {
            all_dialogues.1.remove(&update.dialogue_id);
        }
    }

    return return_value;
}

pub fn build_dialogue_from_state(
    dialogue_id: DialogueId,
    current_state: &Box<Option<StateId>>,
    dialogue_table: &DialogueTable,
    player_id: PlayerId,
    game_state: &GameState,
) -> Option<Dialogue> {
    let satisfied_conditions = check_trigger_conditions(game_state, player_id);
    let script = dialogue_table.scripts.get(&dialogue_id);
    let player = find_my_player(game_state, player_id);
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
                    .filter_map(|(id, text, condition)| {
                        if let Some(condition) = condition {
                            if satisfied_conditions.contains(&condition) {
                                Some(DialogueElem {
                                    substitution: substitute_text(&text, &current_planet, player, game_state),
                                    text,
                                    id,
                                })
                            } else {
                                None
                            }
                        } else {
                            Some(DialogueElem {
                                substitution: substitute_text(&text, &current_planet, player, game_state),
                                text,
                                id,
                            })
                        }
                    } )
                    .collect::<Vec<_>>(),
                prompt: DialogueElem {
                    text: prompt.clone(),
                    // prompt id does not matter since it cannot be selected as action
                    id: Default::default(),
                    substitution: substitute_text(&prompt, &current_planet, player, game_state),
                },
                planet: current_planet,
                left_character: format!("{}", {
                    player.map_or("question.png".to_string(), |p| {
                        format!("{}", p.portrait_name)
                    })
                }),
                right_character: "question".to_string(),
            };
            return Some(result);
        }
    }
    return None;
}

fn substitute_text(
    text: &String,
    current_planet: &Option<Planet>,
    player: Option<&Player>,
    game_state: &GameState,
) -> Vec<DialogueSubstitution> {
    let mut res = vec![];
    let re = &crate::SUB_RE;
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
                eprintln!("s_current_planet_body_type used without current planet");
            }
        } else if cap[0] == *"s_cargo_destination_planet" {
            if let Some(cargo_destination_planet) = player
                .and_then(|p| p.quest.clone())
                .and_then(|q| find_planet(game_state, &q.to_id))
            {
                let cargo_destination_planet = cargo_destination_planet.clone();
                res.push(DialogueSubstitution {
                    s_type: DialogueSubstitutionType::PlanetName,
                    id: cargo_destination_planet.id,
                    text: cargo_destination_planet.name,
                });
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_random_name" {
            res.push(DialogueSubstitution {
                s_type: DialogueSubstitutionType::CharacterName,
                id: new_id(),
                text: gen_random_character_name().to_string(),
            });
        } else if cap[0] == *"s_minerals_amount" {
            if let Some(player) = player {
                if let Some(ship) = find_my_ship(game_state, player.id) {
                    res.push(DialogueSubstitution {
                        s_type: DialogueSubstitutionType::Generic,
                        id: new_id(),
                        text: count_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec()).to_string(),
                    });
                } else {
                    err!("s_minerals_amount used without ship");
                }
            } else {
                err!("s_minerals_amount used without player");
            }
        } else if cap[0] == *"s_minerals_value" {
            if let Some(player) = player {
                if let Some(ship) = find_my_ship(game_state, player.id) {
                    res.push(DialogueSubstitution {
                        s_type: DialogueSubstitutionType::Generic,
                        id: new_id(),
                        text: value_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec()).to_string(),
                    });
                } else {
                    err!("s_minerals_value used without ship");
                }
            } else {
                err!("s_minerals_value used without player");
            }

        }
        else {
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
    player_id: PlayerId,
) -> (Box<Option<StateId>>, bool) {
    // eprintln!("apply start");

    let current_state = *current_state;
    let script = dialogue_table.scripts.get(&update.dialogue_id);
    return if let Some(script) = script {
        if let Some(current_state) = current_state {
            // eprintln!("apply current_state update {:?}", (current_state, update));
            let next_state = script.transitions.get(&(current_state, update.option_id));
            // eprintln!("apply next state {:?}", next_state);
            if let Some(next_state) = next_state {
                let side_effect = apply_side_effects(state, next_state.1.clone(), player_id);
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

fn apply_side_effects(
    state: &mut GameState,
    side_effects: Vec<DialogOptionSideEffect>,
    player_id: PlayerId,
) -> bool {
    let state_read = state.clone();
    let mut state_changed = false;
    for side_effect in side_effects {
        match side_effect {
            DialogOptionSideEffect::Nothing => {}
            DialogOptionSideEffect::Undock => {
                let my_ship = find_my_ship_mut(state, player_id);
                if let Some(my_ship) = my_ship {
                    my_ship.docked_at = None;
                    if let Some(planet_id) = my_ship.docked_at {
                        let planet = find_planet(&state_read, &planet_id).unwrap().clone();
                        let player = find_my_player(&state_read, player_id).unwrap().clone();
                        fire_event(GameEvent::ShipUndocked {
                            ship: my_ship.clone(),
                            planet,
                            player: player.clone(),
                        });
                    }
                    state_changed = true;
                }
            }
            DialogOptionSideEffect::QuestCargoPickup => {
                if let (Some(my_player), Some(ship)) = find_player_and_ship_mut(state, player_id) {
                    let quest = my_player.quest.as_mut();
                    if let Some(mut quest) = quest {
                        quest.state = CargoDeliveryQuestState::Picked;
                        add_item(&mut ship.inventory, InventoryItem::quest_pickup(quest.id))
                    }
                    state_changed = true;
                }
            }
            DialogOptionSideEffect::QuestCargoDropOff => {
                if let (Some(my_player), Some(ship)) = find_player_and_ship_mut(state, player_id) {
                    if let Some(mut quest) = my_player.quest.as_mut() {
                        quest.state = CargoDeliveryQuestState::Delivered;
                        remove_quest_item(&mut ship.inventory, quest.id);
                    }
                    state_changed = true;
                }
            }
            DialogOptionSideEffect::QuestCollectReward => {
                if let Some(mut my_player) = find_my_player_mut(state, player_id) {
                    if let Some(mut quest) = my_player.quest.as_mut() {
                        quest.state = CargoDeliveryQuestState::Delivered;
                        my_player.money += quest.reward;
                        my_player.quest = None;
                    }
                    state_changed = true;
                }
            }
            DialogOptionSideEffect::SellMinerals => {
                let (player, ship) = find_player_and_ship_mut(state, player_id);
                if let (Some( player), Some(ship)) = (player, ship) {
                    let minerals = consume_items_of_types(&mut ship.inventory, &MINERAL_TYPES.to_vec());
                    let sum = minerals.iter().fold(0, |acc, curr| acc + curr.value * curr.quantity);
                    player.money += sum;
                }
            }
            DialogOptionSideEffect::SwitchDialogue(name) => {
                if let Some(player) = find_my_player(state, player_id) {
                    fire_event(GameEvent::DialogueTriggered { dialogue_name: name, player: player.clone() })
                }
            }
            DialogOptionSideEffect::QuitTutorial => {
                // TODO quit from tutorial, make sure UI also quits
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
    res
}

pub fn read_from_resource(file: &str) -> DialogueScript {
    let json = fs::read_to_string(format!("resources/dialogue_scripts/{}.json", file))
        .expect("script not found");
    let result = serde_json::from_str::<ShortScript>(json.as_str());
    if result.is_err() {
        panic!("Failed to load dialogue script {}, err is {:?}", file, result.err());
    }
    let ss = result.unwrap();
    short_decrypt(ss)
}

// option_name, option_text, new_state_name, side_effects, option_condition_name
pub type ShortScriptLine = (String, String, String, Vec<DialogOptionSideEffect>, Option<TriggerCondition>);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShortScript {
    pub name: String,
    pub is_default: bool,
    pub is_planetary: bool,
    pub priority: i32,
    pub initial_state_name: String,
    pub table: HashMap<String, (String, Vec<ShortScriptLine>)>,
    // [[state_name, option_name, condition_for_choosing_it]]
    pub bot_path: Vec<(String, String, Option<TriggerCondition>)>,
}

pub fn short_decrypt(ss: ShortScript) -> DialogueScript {
    let mut script = DialogueScript::new();
    script.id = new_id();
    script.is_default = ss.is_default;
    script.is_planetary = ss.is_planetary;
    script.priority = ss.priority;

    for (state_name, (state_prompt, options)) in ss.table.iter() {
        let state_id = new_id();
        if ss.initial_state_name == *state_name {
            script.initial_state = state_id;
        }
        script.names_db.insert(state_id, state_name.clone());
        script.ids_db.insert(state_name.clone(), state_id);
        script.prompts.insert(state_id, state_prompt.clone());

        for (option_name, _, _, _, _) in options.into_iter() {
            let option_id = new_id();
            script.names_db.insert(option_id, option_name.clone());
            script.ids_db.insert(option_name.clone(), option_id);
        }
    }

    for (state_name, (_, options)) in ss.table.into_iter() {
        let state_id = script.ids_db.get(&state_name).unwrap().clone();
        for (option_name, option_text, next_state_name, side_effects, option_condition) in options.into_iter() {
            let option_id = script.ids_db.get(&option_name).unwrap().clone();
            let next_state_id = if next_state_name != "" {
                Some(script.ids_db.get(&next_state_name).unwrap().clone())
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
