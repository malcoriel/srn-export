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
    static ref BOTS: Arc<Mutex<HashMap<Uuid, Bot>>> = Arc::new(Mutex::new(HashMap::new()));
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
fn add_bot(bot: Bot) -> Uuid {
    let mut bots = BOTS.lock().unwrap();
    let id = bot.id.clone();
    bots.insert(id.clone(), bot);
    let mut cont = STATE.write().unwrap();
    world::add_player(&mut cont.state, &id, true, Some(gen_bot_name()));
    world::spawn_ship(&mut cont.state, &id, None);
    id
}

pub fn bot_thread() {
    add_bot(Bot::new());
    // add_bot(Bot::new());
    // add_bot(Bot::new());
    // add_bot(Bot::new());
    let d_table = *crate::DIALOGUE_TABLE.lock().unwrap().clone();
    let mut last = Local::now();
    loop {
        eprintln!("bot act");
        let now = Local::now();
        let elapsed = now - last;
        last = now;

        if let Some((mut d_states, mut bots, mut state)) = bot_try_lock() {
            let mut ship_updates: HashMap<Uuid, Vec<ShipAction>> = HashMap::new();
            let mut dialogue_updates: HashMap<Uuid, Vec<DialogueUpdate>> = HashMap::new();
            {
                for (bot_id, bot) in bots.clone().iter() {
                    let id: Uuid = *bot_id;
                    let bot_d_states = d_states.entry(id).or_insert((None, HashMap::new()));
                    let (bot, bot_acts) = bot.clone().act(
                        &state.state,
                        elapsed.num_microseconds().unwrap(),
                        &d_table,
                        &bot_d_states,
                    );
                    bots.insert(bot_id.clone(), bot);

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
                        ship_updates.insert(bot_id.clone(), acts);
                    }

                    if speaks.len() > 0 {
                        dialogue_updates.insert(bot_id.clone(), speaks);
                    }
                }
            }
            for (bot_id, ship) in ship_updates.into_iter() {
                for act in ship {
                    let res = mutate_owned_ship(bot_id, act.clone(), None);
                    if let Err(err) = res {
                        eprintln!(
                            "Failed to apply bot action {:?}, error {}",
                            act, err.message
                        );
                    }
                }
            }

            for (bot_id, dialogue_update) in dialogue_updates.into_iter() {
                for act in dialogue_update {
                    execute_dialog_option(
                        &bot_id,
                        &mut state.state,
                        act.clone(),
                        &mut d_states,
                        &d_table,
                    );
                }
            }
        }
        thread::sleep(Duration::from_millis(BOT_SLEEP_MS));
    }
}

fn bot_try_lock() -> Option<(
    MutexGuard<'static, Box<DialogueStates>>,
    MutexGuard<'static, HashMap<Uuid, Bot>>,
    RwLockWriteGuard<'static, StateContainer>,
)> {
    let mut d_states = DIALOGUE_STATES.try_lock();
    let mut bots = BOTS.try_lock();
    let mut state = STATE.try_write();
    if let Ok(d_states) = d_states {
        if let Ok(bots) = bots {
            if let Ok(state) = state {
                return Some((d_states, bots, state));
            } else {
                eprintln!("failed to lock state for bot thread");
            }
        } else {
            eprintln!("failed to lock bots for bot thread");
        }
    } else {
        eprintln!("failed to lock d_states for bot thread");
    }

    None
}
