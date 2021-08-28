use chrono::Local;
use lazy_static::lazy_static;
use rand::rngs::SmallRng;
use rand::{thread_rng, Rng, RngCore, SeedableRng};
use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex, MutexGuard, RwLock, RwLockWriteGuard};
use std::thread;
use std::time::Duration;
use uuid::Uuid;

use crate::api_struct::Room;
use crate::dialogue::{
    check_trigger_conditions, execute_dialog_option, DialogueId, DialogueScript, DialogueState,
    DialogueStates, DialogueStatesForPlayer, DialogueTable, DialogueUpdate, TriggerCondition,
};
use crate::events::fire_event;
use crate::indexing::{find_my_player, find_my_ship, find_planet};
use crate::new_id;
use crate::random_stuff::gen_bot_name;
use crate::ship_action::{apply_ship_action, ShipActionRust};
use crate::states::StateContainer;
use crate::world;
use crate::world::{CargoDeliveryQuestState, GameEvent, GameState, Ship};
use crate::DIALOGUE_STATES;
use crate::STATE;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Bot {
    pub id: Uuid,
    pub timer: Option<i64>,
}

const BOT_SLEEP_MS: u64 = 200;
const BOT_QUEST_ACT_DELAY_MC: i64 = 2 * 1000 * 1000;

pub enum BotAct {
    Speak(DialogueUpdate),
    Act(ShipActionRust),
}

impl Bot {
    pub fn new() -> Self {
        Bot {
            id: new_id(),
            timer: Some(0),
        }
    }
    pub fn act(
        mut self,
        state: &GameState,
        elapsed_micro: i64,
        d_table: &DialogueTable,
        bot_d_states: &DialogueStatesForPlayer,
    ) -> (Self, Vec<BotAct>) {
        let player = find_my_player(&state, self.id);
        let conditions = check_trigger_conditions(state, self.id);
        if player.is_none() {
            eprintln!("{} no player", self.id);
            return (self, vec![]);
        }
        let ship = find_my_ship(&state, self.id);
        if ship.is_none() {
            return (self, vec![]);
        }
        let player = player.unwrap();
        let quest = player.quest.clone();
        if quest.is_none() {
            return (self, vec![]);
        }
        let quest = quest.unwrap();

        let mut result_actions = vec![];

        if bot_d_states.1.iter().count() > 0 {
            // stop all other actions when talking
            if self.timer.is_none() {
                let mut new_rng = thread_rng();
                self.timer = Some(BOT_QUEST_ACT_DELAY_MC + new_rng.gen_range(-500, 500) * 1000);
            } else {
                self.timer = Some(self.timer.unwrap() - elapsed_micro);
                if self.timer.unwrap() <= 0 {
                    self.timer = Some(BOT_QUEST_ACT_DELAY_MC);
                    // time to act on all the dialogues
                    for (dialogue_id, _) in bot_d_states.1.iter() {
                        let act =
                            self.make_dialogue_act(d_table, bot_d_states, *dialogue_id, state);
                        if let Some(act) = act {
                            result_actions.push(act);
                        }
                    }
                } else {
                    // still waiting
                }
            }
        } else {
            if quest.state == CargoDeliveryQuestState::Started
                && !conditions.contains(&TriggerCondition::CurrentPlanetIsPickup)
            {
                result_actions.push(BotAct::Act(ShipActionRust::DockNavigate {
                    target: quest.from_id,
                }));
            } else if quest.state == CargoDeliveryQuestState::Picked
                && !conditions.contains(&TriggerCondition::CurrentPlanetIsDropoff)
            {
                result_actions.push(BotAct::Act(ShipActionRust::DockNavigate {
                    target: quest.to_id,
                }));
            }
        }

        return (self, result_actions);
    }

    fn make_dialogue_act(
        &self,
        d_table: &DialogueTable,
        bot_d_states: &(Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>),
        dialogue_id: Uuid,
        game_state: &GameState,
    ) -> Option<BotAct> {
        let current_script: &DialogueScript = d_table.scripts.get(&dialogue_id).unwrap();
        let current_dialogue_name = current_script.name.clone();
        let current_d_state = bot_d_states.1.get(&current_script.id);
        // eprintln!("working on script {}, bot {}", current_script.name, self.id);
        current_d_state
            .and_then(|current_d_state| {
                // if let Some(state_id) = *current_d_state.clone() {
                //     // eprintln!("current state {}", current_script.get_name(&state_id));
                // }

                let option = current_script.get_next_bot_path(
                    &*(current_d_state.clone()),
                    game_state,
                    self.id,
                );
                if option.is_none() {
                    warn!(format!(
                        "Bot {:?} is stuck without dialogue option in dialogue {} state {:?}",
                        self, current_dialogue_name, current_d_state
                    ))
                } else {
                }
                option
            })
            .and_then(|opt| {
                // eprintln!("chosen {}", current_script.get_name(opt));
                Some(BotAct::Speak(DialogueUpdate {
                    dialogue_id: current_script.id,
                    option_id: opt.clone(),
                }))
            })
    }
}

fn add_bot(room: &mut Room, bot: Bot) {
    let id = bot.id.clone();
    room.bots.push(bot);
    let mut rng = thread_rng();
    let mut prng = SmallRng::seed_from_u64(rng.next_u64());
    world::add_player(&mut room.state, id, true, Some(gen_bot_name(&mut prng)));
    world::spawn_ship(&mut room.state, id, None);
    eprintln!("room {} now has {} bots", room.id, room.bots.len());
}

pub fn bot_init(room: &mut Room) {
    add_bot(room, Bot::new());
    add_bot(room, Bot::new());
    add_bot(room, Bot::new());
    add_bot(room, Bot::new());
}

pub fn format_d_states(
    d_states: &HashMap<DialogueId, DialogueState>,
    d_table: &DialogueTable,
) -> HashMap<String, String> {
    let mut res = HashMap::new();
    for (key, val) in d_states.iter() {
        let script = d_table.scripts.get(key).unwrap();
        let state_name = if val.is_some() {
            script.names_db.get(&(*val).unwrap()).unwrap().clone()
        } else {
            "None".to_string()
        };
        res.insert(format!("{}:{}", script.name.clone(), key), state_name);
    }
    res
}

pub fn do_bot_actions(
    room: &mut Room,
    d_states: &mut DialogueStates,
    d_table: &DialogueTable,
    elapsed_micro: i64,
) {
    let mut ship_updates: HashMap<Uuid, Vec<ShipActionRust>> = HashMap::new();
    let mut dialogue_updates: HashMap<Uuid, Vec<DialogueUpdate>> = HashMap::new();

    for orig_bot in room.bots.iter_mut() {
        let id: Uuid = orig_bot.id;
        let bot_d_states = d_states.entry(id).or_insert((None, HashMap::new()));
        let (bot, bot_acts) =
            orig_bot
                .clone()
                .act(&room.state, elapsed_micro, &d_table, &bot_d_states);
        *orig_bot = bot;

        let mut acts = vec![];
        let mut speaks = vec![];

        for bot_act in bot_acts.into_iter() {
            match bot_act {
                BotAct::Speak(v) => {
                    speaks.push(v);
                }
                BotAct::Act(v) => {
                    acts.push(v);
                }
            }
        }

        if acts.len() > 0 {
            ship_updates.insert(id, acts);
        }

        if speaks.len() > 0 {
            dialogue_updates.insert(id, speaks);
        }
    }

    for (bot_id, acts) in ship_updates.into_iter() {
        for act in acts {
            let updated_ship = apply_ship_action(act.clone(), &mut room.state, bot_id, false);
            if let Some(updated_ship) = updated_ship {
                world::try_replace_ship(&mut room.state, &updated_ship, bot_id);
            }
        }
    }

    for (bot_id, dialogue_update) in dialogue_updates.into_iter() {
        for act in dialogue_update {
            // eprintln!("executing {:?}", act);
            execute_dialog_option(bot_id, &mut room.state, act.clone(), d_states, &d_table);
        }
    }
}
