use crate::vec2::Vec2f64;
use chrono::Local;
use lazy_static::lazy_static;
use rand::rngs::SmallRng;
use rand::{thread_rng, Rng, RngCore, SeedableRng};
use std::collections::{HashMap, HashSet};
use std::sync::{mpsc, Arc, Mutex, MutexGuard, RwLock, RwLockWriteGuard};
use std::thread;
use std::time::Duration;
use uuid::Uuid;

use crate::api_struct::{new_bot, AiTrait, Bot, Room};
use crate::autofocus::{object_index_into_object_pos, object_index_into_object_id};
use crate::dialogue::{
    check_trigger_conditions, execute_dialog_option, DialogueId, DialogueScript, DialogueState,
    DialogueStates, DialogueStatesForPlayer, DialogueTable, DialogueUpdate, TriggerCondition,
};
use crate::long_actions::{LongAction};
use crate::events::fire_event;
use crate::indexing::{find_my_player, find_my_ship, find_planet, ObjectIndexSpecifier, ObjectSpecifier};
use crate::random_stuff::gen_bot_name;
use crate::ship_action::{apply_ship_action, ShipActionRust};
use crate::states::StateContainer;
use crate::world;
use crate::world::{CargoDeliveryQuestState, GameEvent, GameState, Ship, ShipIdx, SpatialIndexes};
use crate::DIALOGUE_STATES;
use crate::STATE;
use crate::{indexing, new_id};
use std::iter::FromIterator;

const BOT_SLEEP_MS: u64 = 200;
const BOT_QUEST_ACT_DELAY_MC: i64 = 2 * 1000 * 1000;

pub enum BotAct {
    Speak(DialogueUpdate),
    Act(ShipActionRust),
}

pub fn bot_act(
    mut bot: Bot,
    state: &GameState,
    elapsed_micro: i64,
    d_table: &DialogueTable,
    bot_d_states: &DialogueStatesForPlayer,
) -> (Bot, Vec<BotAct>) {
    let player = find_my_player(&state, bot.id);
    let conditions = check_trigger_conditions(state, bot.id);
    if player.is_none() {
        eprintln!("{} no player", bot.id);
        return (bot, vec![]);
    }
    let ship = find_my_ship(&state, bot.id);
    if ship.is_none() {
        return (bot, vec![]);
    }
    let player = player.unwrap();
    let quest = player.quest.clone();
    if quest.is_none() {
        return (bot, vec![]);
    }
    let quest = quest.unwrap();

    let mut result_actions = vec![];

    if bot_d_states.1.iter().count() > 0 {
        // stop all other actions when talking
        if bot.timer.is_none() {
            let mut new_rng = thread_rng();
            bot.timer = Some(BOT_QUEST_ACT_DELAY_MC + new_rng.gen_range(-500, 500) * 1000);
        } else {
            bot.timer = Some(bot.timer.unwrap() - elapsed_micro);
            if bot.timer.unwrap() <= 0 {
                bot.timer = Some(BOT_QUEST_ACT_DELAY_MC);
                // time to act on all the dialogues
                for (dialogue_id, _) in bot_d_states.1.iter() {
                    let act = make_dialogue_act(&bot, d_table, bot_d_states, *dialogue_id, state);
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

    return (bot, result_actions);
}

fn make_dialogue_act(
    bot: &Bot,
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

            let option =
                current_script.get_next_bot_path(&*(current_d_state.clone()), game_state, bot.id);
            if option.is_none() {
                warn!(format!(
                    "Bot {:?} is stuck without dialogue option in dialogue {} state {:?}",
                    bot, current_dialogue_name, current_d_state
                ))
            } else {}
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

fn add_bot(room: &mut Room, bot: Bot) {
    let id = bot.id.clone();
    room.bots.push(bot);
    let mut rng = thread_rng();
    let mut prng = SmallRng::seed_from_u64(rng.next_u64());
    world::add_player(&mut room.state, id, true, Some(gen_bot_name(&mut prng)));
    world::spawn_ship(&mut room.state, Some(id), None, None, None);
}

pub fn bot_init(room: &mut Room) {
    add_bot(room, new_bot(None));
    add_bot(room, new_bot(None));
    add_bot(room, new_bot(None));
    add_bot(room, new_bot(None));
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

pub fn do_bot_players_actions(
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
        let (bot, bot_acts) = bot_act(
            orig_bot.clone(),
            &room.state,
            elapsed_micro,
            &d_table,
            &bot_d_states,
        );
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
            let ship_idx = indexing::find_my_ship_index(&room.state, bot_id);
            let updated_ship = apply_ship_action(act.clone(), &mut room.state, ship_idx, false);
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

pub fn do_bot_npcs_actions(room: &mut Room, elapsed_micro: i64, spatial_indexes: &SpatialIndexes) {
    let mut ship_updates: HashMap<Uuid, (Vec<ShipActionRust>, ShipIdx)> = HashMap::new();

    for i in 0..room.state.locations.len() {
        let room_state_clone = room.state.clone();
        let ship_len = room.state.locations[i].ships.len();
        let loc = &mut room.state.locations[i];
        for j in 0..ship_len {
            let ship_idx = ShipIdx {
                location_idx: i,
                ship_idx: j,
            };
            let ship = &mut loc.ships[j];
            if ship.npc.is_some() {
                let (npc, bot_acts) = npc_act(
                    &ship.clone(),
                    &room_state_clone,
                    elapsed_micro,
                    &ship_idx,
                    spatial_indexes,
                );
                ship.npc = npc;
                ship_updates.insert(ship.id, (bot_acts, ship_idx));
            }
        }
    }

    for (_ship_id, (acts, idx)) in ship_updates.into_iter() {
        for act in acts {
            let updated_ship =
                apply_ship_action(act.clone(), &mut room.state, Some(idx.clone()), false);
            if let Some(updated_ship) = updated_ship {
                world::try_replace_ship_npc(&mut room.state, &updated_ship, Some(idx.clone()));
            }
        }
    }
}

fn npc_act(
    ship: &Ship,
    state: &GameState,
    _elapsed_micro: i64,
    ship_idx: &ShipIdx,
    spatial_indexes: &SpatialIndexes,
) -> (Option<Bot>, Vec<ShipActionRust>) {
    if ship.npc.is_none() {
        return (None, vec![]);
    }
    let bot = ship.npc.clone().unwrap();
    let mut res = vec![];
    let trait_set: HashSet<AiTrait> = HashSet::from_iter(bot.traits.clone().into_iter());
    let not_landing = ship.long_actions.iter().filter(|la| matches!(la, LongAction::Dock { .. })).count() == 0;
    if trait_set.contains(&AiTrait::ImmediatePlanetLand) && ship.dock_target.is_none() && not_landing && ship.docked_at.is_none() {
        let closest_planet = find_closest_planet(
            &Vec2f64 {
                x: ship.x,
                y: ship.y,
            },
            state,
            ship_idx.location_idx,
            spatial_indexes,
        );
        if let Some(cp) = closest_planet {
            res.push(ShipActionRust::DockNavigate { target: cp })
        }
    }

    return (Some(bot), res);
}

pub const MAX_CLOSEST_PLANET_SEARCH: f64 = 500.0;

fn find_closest_planet(
    position: &Vec2f64,
    state: &GameState,
    location_idx: usize,
    spatial_indexes: &SpatialIndexes,
) -> Option<Uuid> {
    let index = spatial_indexes.values.get(&location_idx).unwrap();
    let objects = index.rad_search(&position, MAX_CLOSEST_PLANET_SEARCH);
    let distances = objects
        .iter()
        .filter_map(|ois| {
            if !matches!(ois, ObjectIndexSpecifier::Planet { .. }) {
                return None;
            }
            let pos = object_index_into_object_pos(ois, &state.locations[location_idx]).unwrap();
            return Some((pos.euclidean_distance(position), ois));
        })
        .collect::<Vec<_>>();

    let mut min_dist = 9999.0;
    let mut min_oid = None;
    for (dist, oid) in distances {
        if dist < min_dist {
            min_dist = dist;
            min_oid = Some(oid);
        }
    }

    if let Some(min_oid) = min_oid {
        return object_index_into_object_id(min_oid, &state.locations[location_idx]).and_then(|oid| {
            return match oid {
                ObjectSpecifier::Planet { id } => {
                    Some(id)
                }
                _ => {
                    None
                }
            };
        });
    }
    return None;
}
