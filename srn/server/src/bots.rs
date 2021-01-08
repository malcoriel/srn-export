use crate::world::{
    execute_dialog_option, find_my_player, find_my_ship, find_planet, GameEvent, GameState,
    QuestState, Ship, ShipAction, ShipActionType,
};
use crate::{fire_event, mutate_owned_ship, new_id, StateContainer};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Bot {
    pub id: Uuid,
    pub timer: Option<i64>,
}

use crate::random_stuff::gen_bot_name;
use crate::world;
use crate::DIALOGUE_STATES;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex, MutexGuard, RwLock, RwLockWriteGuard};
use std::thread;
use std::time::Duration;

lazy_static! {
    pub static ref BOTS: Arc<Mutex<Vec<Bot>>> = Arc::new(Mutex::new(vec![]));
}

use crate::dialogue::{
    DialogueId, DialogueScript, DialogueStates, DialogueStatesForPlayer, DialogueTable,
    DialogueUpdate,
};
use crate::STATE;
use chrono::Local;

const BOT_SLEEP_MS: u64 = 200;
const BOT_QUEST_ACT_DELAY_MC: i64 = 1000 * 1000;

pub enum BotAct {
    Speak(DialogueUpdate),
    Act(ShipAction),
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
        let player = find_my_player(&state, &self.id);
        if player.is_none() {
            eprintln!("{} no player", self.id);
            return (self, vec![]);
        }
        let ship = find_my_ship(&state, &self.id);
        if ship.is_none() {
            eprintln!("{} no ship", self.id);
            return (self, vec![]);
        }
        let player = player.unwrap();
        let ship = ship.unwrap();

        if let Some(quest) = player.quest.clone() {
            let action = if quest.state == QuestState::Started {
                if ship.docked_at.map_or(false, |d| d == quest.from_id) {
                    if self.timer.is_none() {
                        self.timer = Some(BOT_QUEST_ACT_DELAY_MC);
                        None
                    } else {
                        self.timer = Some(self.timer.unwrap() - elapsed_micro);
                        if self.timer.unwrap() <= 0 {
                            // time to act on the dialogue
                            self.make_dialogue_act(d_table, bot_d_states, "cargo_delivery_pickup")
                        } else {
                            // still waiting
                            None
                        }
                    }
                } else {
                    Some(BotAct::Act(ShipAction {
                        // this action doubles as undock
                        s_type: ShipActionType::DockNavigate,
                        data: format!("\"{}\"", quest.from_id),
                    }))
                }
            } else if quest.state == QuestState::Picked {
                if ship.docked_at.map_or(false, |d| d == quest.from_id) {
                    if self.timer.is_none() {
                        self.timer = Some(BOT_QUEST_ACT_DELAY_MC);
                        None
                    } else {
                        self.timer = Some(self.timer.unwrap() - elapsed_micro);
                        if self.timer.unwrap() <= 0 {
                            // time to act on the dialogue
                            self.make_dialogue_act(d_table, bot_d_states, "cargo_delivery_dropoff")
                        } else {
                            // still waiting
                            None
                        }
                    }
                } else {
                    Some(BotAct::Act(ShipAction {
                        // this action doubles as undock
                        s_type: ShipActionType::DockNavigate,
                        data: format!("\"{}\"", quest.from_id),
                    }))
                }
            } else {
                None
            };
            if action.is_some() {
                (self, vec![action.unwrap()])
            } else {
                (self, vec![])
            }
        } else {
            (self, vec![])
        }
    }

    fn make_dialogue_act(
        &self,
        d_table: &DialogueTable,
        bot_d_states: &(Option<Uuid>, HashMap<Uuid, Box<Option<Uuid>>>),
        current_dialogue_name: &str,
    ) -> Option<BotAct> {
        let current_script: &DialogueScript = d_table.get_by_name(current_dialogue_name).unwrap();
        let current_d_state = bot_d_states.1.get(&current_script.id);
        eprintln!("triggering next dialogue action for {}", self.id);
        current_d_state
            .and_then(|current_d_state| {
                current_script.get_next_bot_path(&*(current_d_state.clone()))
            })
            .and_then(|opt| {
                eprintln!("chosen {:?}", opt);
                Some(BotAct::Speak(DialogueUpdate {
                    dialogue_id: Default::default(),
                    option_id: opt.clone(),
                }))
            })
    }
}
fn add_bot(bot: Bot, bots: &mut Vec<Bot>) -> Uuid {
    let id = bot.id.clone();
    bots.push(bot);
    let mut cont = STATE.write().unwrap();
    world::add_player(&mut cont.state, &id, true, Some(gen_bot_name()));
    world::spawn_ship(&mut cont.state, &id, None);
    id
    // new_id()
}

pub fn bot_init(bots: &mut Vec<Bot>) {
    add_bot(Bot::new(), bots);
    add_bot(Bot::new(), bots);
    add_bot(Bot::new(), bots);
    add_bot(Bot::new(), bots);
}

pub fn do_bot_actions(
    state: &mut GameState,
    bots: &mut Vec<Bot>,
    d_states: &mut DialogueStates,
    d_table: &DialogueTable,
    elapsed_micro: i64,
) {
    let mut ship_updates: HashMap<Uuid, Vec<ShipAction>> = HashMap::new();
    let mut dialogue_updates: HashMap<Uuid, Vec<DialogueUpdate>> = HashMap::new();

    for orig_bot in bots.iter_mut() {
        let id: Uuid = orig_bot.id;
        let bot_d_states = d_states.entry(id).or_insert((None, HashMap::new()));
        let (bot, bot_acts) = orig_bot
            .clone()
            .act(&state, elapsed_micro, &d_table, &bot_d_states);
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

    // for (bot_id, ship) in ship_updates.into_iter() {
    //     for act in ship {
    //         let res = mutate_owned_ship(bot_id, act.clone(), None);
    //         if let Err(err) = res {
    //             eprintln!(
    //                 "Failed to apply bot action {:?}, error {}",
    //                 act, err.message
    //             );
    //         }
    //     }
    // }
    //
    // for (bot_id, dialogue_update) in dialogue_updates.into_iter() {
    //     for act in dialogue_update {
    //         execute_dialog_option(&bot_id, state, act.clone(), d_states, &d_table);
    //     }
    // }
}
