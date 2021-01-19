use std::borrow::BorrowMut;
use std::collections::HashMap;
use std::fs;
use std::slice::Iter;

use itertools::Itertools;
use regex::Regex;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

use crate::fire_event;
use crate::new_id;
use crate::random_stuff::gen_random_character_name;
use crate::world::{
    find_my_player, find_my_player_mut, find_my_ship, find_my_ship_mut, find_planet,
    generate_random_quest, CargoDeliveryQuestState, GameEvent, GameState, Planet, Player, PlayerId,
};

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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DialogueScript {
    pub id: Uuid,
    pub transitions: HashMap<(StateId, OptionId), (Option<StateId>, Vec<DialogOptionSideEffect>)>,
    pub prompts: HashMap<StateId, String>,
    pub options: HashMap<StateId, Vec<(OptionId, String)>>,
    pub initial_state: StateId,
    pub is_planetary: bool,
    pub priority: u32,
    pub is_default: bool,
    pub name: String,
    pub bot_path: HashMap<StateId, OptionId>,
    names_db: HashMap<Uuid, String>,
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
    pub fn get_next_bot_path(&self, current_state: &Option<StateId>) -> Option<&OptionId> {
        return current_state.and_then(|cs| self.bot_path.get(&cs));
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
        d_id: Uuid,
        script: &DialogueScript,
        res: &mut Vec<(Uuid, Option<Dialogue>)>,
        player: &Player,
        player_d_states: &mut HashMap<Uuid, Box<Option<Uuid>>>,
        game_state: &GameState,
    ) {
        let key = d_id;
        let value = Box::new(Some(script.initial_state));
        res.push((
            player.id,
            build_dialogue_from_state(d_id, &value, self, player.id, game_state),
        ));
        player_d_states.insert(key.clone(), value);
    }

    pub fn try_trigger(
        &self,
        state: &GameState,
        d_states: &mut HashMap<Uuid, (Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>)>,
        mut res: &mut Vec<(Uuid, Option<Dialogue>)>,
        player: &Player,
    ) {
        let (_current_player_dialogue, player_d_states) =
            d_states.entry(player.id).or_insert((None, HashMap::new()));

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
                // eprintln!("catch!");
                break;
            }
        }
        if d_script.is_none() {
            return;
        }
        let d_script = d_script.unwrap();
        let d_id = d_script.id;
        let ship = find_my_ship(state, player.id);
        if let Some(ship) = ship {
            if let Some(_docked_at) = ship.docked_at {
                if !player_d_states.contains_key(&d_id) {
                    self.trigger_dialogue(d_id, d_script, &mut res, player, player_d_states, state);
                } else {
                    let existing_state = player_d_states.get(&d_id).unwrap();
                    if existing_state.is_none() {
                        self.trigger_dialogue(
                            d_id,
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
    if let Some(all_dialogues) = dialogue_states.get_mut(&client_id) {
        if let Some(dialogue_state) = all_dialogues.1.get_mut(&update.dialogue_id) {
            let (new_state, side_effect) = apply_dialogue_option(
                dialogue_state.clone(),
                &update,
                dialogue_table,
                state,
                client_id,
            );
            *dialogue_state = new_state;
            return (
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
    }

    return (None, false);
}

pub fn build_dialogue_from_state(
    dialogue_id: DialogueId,
    current_state: &Box<Option<StateId>>,
    dialogue_table: &DialogueTable,
    player_id: PlayerId,
    game_state: &GameState,
) -> Option<Dialogue> {
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
                    .map(|(id, text)| DialogueElem {
                        substitution: substitute_text(&text, &current_planet, player, game_state),
                        text,
                        id,
                    })
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
                if let Some(my_player) = find_my_player_mut(state, player_id) {
                    let quest = my_player.quest.as_mut();
                    if let Some(mut quest) = quest {
                        quest.state = CargoDeliveryQuestState::Picked;
                    }
                    state_changed = true;
                }
            }
            DialogOptionSideEffect::QuestCargoDropOff => {
                if let Some(my_player) = find_my_player_mut(state, player_id) {
                    if let Some(mut quest) = my_player.quest.as_mut() {
                        quest.state = CargoDeliveryQuestState::Delivered;
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
        }
    }
    return state_changed;
}

pub fn gen_basic_planet_script() -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, DialogueScript) {
    let dialogue_id = new_id();
    let d_name = "basic_planet".to_string();

    let mut script = DialogueScript {
        id: dialogue_id,
        transitions: Default::default(),
        prompts: Default::default(),
        options: Default::default(),
        initial_state: Default::default(),
        is_planetary: true,
        priority: 0,
        is_default: true,
        name: d_name.clone(),
        bot_path: Default::default(),
        names_db: Default::default(),
        ids_db: Default::default(),
    };

    script.names_db.insert(dialogue_id, d_name);

    let arrival = new_id();
    script.names_db.insert(arrival, "arrival".to_string());
    let market = new_id();
    script.names_db.insert(market, "market".to_string());
    let go_market = new_id();
    script.names_db.insert(go_market, "go_market".to_string());
    let go_back = new_id();
    script.names_db.insert(go_back, "go_back".to_string());
    let go_exit = new_id();
    script.names_db.insert(go_exit, "go_exit".to_string());

    script.bot_path.insert(arrival.clone(), go_exit.clone());
    script.initial_state = arrival;
    script
        .prompts
        .insert(arrival, "You have landed on the s_current_planet_body_type s_current_planet. The space port is buzzing with activity, but there's nothing of interest here for you.".to_string());
    script
        .prompts
        .insert(market, "You come to the marketplace on s_current_planet, but suddenly realize that you forgot your wallet on the ship! So there is nothing here for you. Maybe there will be something in the future?".to_string());
    script.transitions.insert(
        (arrival, go_market),
        (Some(market), vec![DialogOptionSideEffect::Nothing]),
    );
    script.transitions.insert(
        (market, go_back),
        (Some(arrival), vec![DialogOptionSideEffect::Nothing]),
    );
    script.transitions.insert(
        (arrival, go_exit),
        (None, vec![DialogOptionSideEffect::Undock]),
    );
    script.transitions.insert(
        (market, go_exit),
        (None, vec![DialogOptionSideEffect::Undock]),
    );
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

pub fn gen_scripts() -> Vec<DialogueScript> {
    let mut res = vec![];
    let basic_planet = gen_basic_planet_script();
    res.push(basic_planet.6);
    res.push(read_from_resource("cargo_delivery_pickup"));
    res.push(gen_quest_dropoff_planet_script());
    res
}

fn gen_quest_dropoff_planet_script() -> DialogueScript {
    let dialogue_id = new_id();
    let d_name = "cargo_delivery_dropoff".to_string();

    let mut script = DialogueScript {
        id: dialogue_id,
        transitions: Default::default(),
        prompts: Default::default(),
        options: Default::default(),
        initial_state: Default::default(),
        is_planetary: true,
        priority: 1,
        is_default: false,
        name: d_name.clone(),
        bot_path: Default::default(),
        names_db: Default::default(),
        ids_db: Default::default(),
    };

    script.names_db.insert(dialogue_id, d_name);
    let arrival = new_id();
    script.names_db.insert(arrival, "arrival".to_string());
    let dropped_off = new_id();
    script
        .names_db
        .insert(dropped_off, "dropped_off".to_string());
    let go_drop_off = new_id();
    script
        .names_db
        .insert(go_drop_off, "go_drop_off".to_string());
    let go_exit_no_drop_off = new_id();
    script
        .names_db
        .insert(go_exit_no_drop_off, "go_exit_no_drop_off".to_string());
    let go_exit_dropped_off = new_id();
    script
        .names_db
        .insert(go_exit_dropped_off, "go_exit_dropped_off".to_string());

    script.bot_path.insert(arrival.clone(), go_drop_off.clone());
    script
        .bot_path
        .insert(dropped_off.clone(), go_exit_dropped_off.clone());

    script.initial_state = arrival;

    script
        .prompts
        .insert(arrival, "You land on the s_current_planet_body_type s_current_planet. Here you must deliver the crate you are carrying to somebody.".to_string());
    script.options.insert(
        arrival,
        vec![
            (
                go_drop_off,
                "Find the person that you have to give the cargo to".to_string(),
            ),
            (go_exit_no_drop_off, "Undock and fly away".to_string()),
        ],
    );
    script.transitions.insert(
        (arrival, go_drop_off),
        (
            Some(dropped_off),
            vec![DialogOptionSideEffect::QuestCargoDropOff],
        ),
    );
    script.transitions.insert(
        (arrival, go_exit_no_drop_off),
        (None, vec![DialogOptionSideEffect::Undock]),
    );

    script
        .prompts
        .insert(dropped_off, "You find a businessman that thanks you, grabs the crate and hands you off some credits as a reward. He refuses to comment what was in the cargo, though.".to_string());
    script.options.insert(
        dropped_off,
        vec![(
            go_exit_dropped_off,
            "Collect your reward and fly away.".to_string(),
        )],
    );
    script.transitions.insert(
        (dropped_off, go_exit_dropped_off),
        (
            None,
            vec![
                DialogOptionSideEffect::Undock,
                DialogOptionSideEffect::QuestCollectReward,
            ],
        ),
    );

    script
}

pub fn read_from_resource(file: &str) -> DialogueScript {
    let json = fs::read_to_string(format!("src/dialogue_scripts/{}.json", file))
        .expect("script not found");
    let ss = serde_json::from_str::<ShortScript>(json.as_str()).unwrap();
    short_decrypt(ss)
}

pub type ShortScriptLine = (String, String, String, Vec<DialogOptionSideEffect>);

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShortScript {
    pub name: String,
    pub is_default: bool,
    pub is_planetary: bool,
    pub priority: u32,
    pub initial_state_name: String,
    pub table: HashMap<String, (String, Vec<ShortScriptLine>)>,
    pub bot_path: Vec<String>,
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

        for (option_name, _, _, _) in options.into_iter() {
            let option_id = new_id();
            script.names_db.insert(option_id, option_name.clone());
            script.ids_db.insert(option_name.clone(), option_id);
        }
    }

    for (state_name, (_, options)) in ss.table.into_iter() {
        let state_id = script.ids_db.get(&state_name).unwrap().clone();
        for (option_name, option_text, next_state_name, side_effects) in options.into_iter() {
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
            current_opts.push((option_id, option_text));
        }
    }

    let mut last_state_id = script.initial_state;
    for option_name in ss.bot_path {
        let option_id = script.ids_db.get(&option_name).unwrap().clone();
        script.bot_path.insert(last_state_id, option_id);
        let next_state = script
            .transitions
            .get(&(last_state_id, option_id))
            .unwrap()
            .clone();
        last_state_id = next_state.0.unwrap_or(script.initial_state);
    }
    script.name = ss.name;
    script
}
