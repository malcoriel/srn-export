use crate::world::{find_my_player, find_my_ship, GameEvent, GameState, QuestState, Ship};
use crate::{fire_event, new_id};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Bot {
    pub id: Uuid,
}

use crate::random_stuff::gen_bot_name;
use crate::world;
use crate::DIALOGUES_STATES;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

lazy_static! {
    static ref BOTS: Arc<Mutex<HashMap<Uuid, Bot>>> = Arc::new(Mutex::new(HashMap::new()));
}

use crate::STATE;
const BOT_SLEEP_MS: u64 = 200;

impl Bot {
    pub fn new() -> Self {
        Bot { id: new_id() }
    }
    pub fn act(self, state: GameState) -> (Self, Option<Ship>) {
        let player = find_my_player(&state, &self.id);
        if player.is_none() {
            eprintln!("{} no player", self.id);
            return (self, None);
        }
        let ship = find_my_ship(&state, &self.id);
        if ship.is_none() {
            eprintln!("{} no ship", self.id);
            return (self, None);
        }
        let ship_read = ship.unwrap();
        let mut ship = ship_read.clone();
        let player = player.unwrap();

        let target = if let Some(quest) = &player.quest {
            if quest.state == QuestState::Started {
                Some(quest.from_id)
            } else if quest.state == QuestState::Picked {
                Some(quest.to_id)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(target) = target {
            ship.dock_target = Some(target.clone());
            if let Some(planet_id) = ship_read.docked_at {
                ship.docked_at = None;
                fire_event(GameEvent::ShipUndocked {
                    ship_id: ship.id,
                    planet_id,
                });
            }
        }

        (self, Some(ship))
    }
}
fn add_bot(bot: Bot) -> Uuid {
    let mut bots = BOTS.lock().unwrap();
    let id = bot.id.clone();
    bots.insert(id.clone(), bot);
    let mut cont = STATE.write().unwrap();
    let mut d_states = DIALOGUES_STATES.lock().unwrap();
    world::add_player(
        &mut cont.state,
        &id,
        true,
        Some(gen_bot_name()),
        &mut *d_states,
    );
    world::spawn_ship(&mut cont.state, &id, None);
    id
}

pub(crate) fn bot_thread() {
    // add_bot(Bot::new());
    // add_bot(Bot::new());
    // add_bot(Bot::new());
    // add_bot(Bot::new());
    loop {
        let mut ship_updates: HashMap<Uuid, Ship> = HashMap::new();
        let mut bots = BOTS.lock().unwrap();
        let extracted_state = STATE.write().unwrap().state.clone();
        {
            for (bot_id, bot) in bots.clone().iter() {
                let (bot, ship) = bot.clone().act(extracted_state.clone());
                bots.insert(bot_id.clone(), bot);
                if let Some(ship) = ship {
                    ship_updates.insert(bot_id.clone(), ship);
                }
            }
        }
        for (bot_id, ship) in ship_updates.into_iter() {
            // TODO make compatible with ship actions
            // mutate_owned_ship_wrapped(bot_id, ship, None);
        }
        thread::sleep(Duration::from_millis(BOT_SLEEP_MS));
    }
}
