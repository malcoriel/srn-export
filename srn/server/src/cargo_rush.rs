use crate::{bots, fire_event, indexing, notifications, prng_id, world, Room};
use itertools::Itertools;

use crate::indexing::{ObjectSpecifier};
use rand_pcg::Pcg64Mcg;
use rand::prelude::*;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use world::GameState;

use crate::api_struct::{new_bot, AiTrait};
use crate::bots::add_bot;
use crate::inventory::has_quest_item;
use crate::notifications::{Notification, NotificationText};
use crate::substitutions::substitute_notification_texts;
use crate::world::{fire_saved_event, Leaderboard, PlanetV2};
use crate::world_events::GameEvent;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashSet;
use std::iter::FromIterator;
use wasm_bindgen::prelude::*;
use world::Player;

pub fn on_create_room(room: &mut Room, prng: &mut Pcg64Mcg) {
    let traits = Some(vec![AiTrait::CargoRushHauler]);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    // add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    // add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    // add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
}

pub fn on_ship_docked(state: &mut GameState, player_id: Option<Uuid>, planet_id: Uuid) {
    if let Some(player_id) = player_id {
        fire_saved_event(
            state,
            GameEvent::DialogueTriggerRequest {
                dialogue_name: "basic_planet".to_owned(),
                player_id,
                target: Some(ObjectSpecifier::Planet {id: planet_id}),
            },
        );
    }
}

pub fn generate_random_quest(
    player: &mut Player,
    planets: &Vec<PlanetV2>,
    docked_at: Option<Uuid>,
    prng: &mut Pcg64Mcg,
) {
    if planets.len() <= 0 {
        return;
    }
    let from = world::get_random_planet(planets, docked_at, prng);
    if from.is_none() {
        return;
    }
    let from = from.unwrap();
    let delivery = planets
        .into_iter()
        .filter(|p| p.id != from.id)
        .collect::<Vec<_>>();
    let to = &delivery[prng.gen_range(0, delivery.len())];
    let reward = prng.gen_range(500, 1001);
    let quest = Quest {
        id: prng_id(prng),
        from_id: from.id,
        to_id: to.id,
        state: CargoDeliveryQuestState::Started,
        reward,
    };
    player.quest = Some(quest);
    notifications::update_quest_notifications(player, prng);
}

pub fn make_leaderboard(all_players: &Vec<Player>) -> Option<Leaderboard> {
    let rating = all_players
        .into_iter()
        .sorted_by(|a, b| Ord::cmp(&b.money, &a.money))
        .map(|p| (p.clone(), get_player_score(p)))
        .collect::<Vec<_>>();
    let winner: String = rating
        .iter()
        .nth(0)
        .map_or("Nobody".to_string(), |p| p.0.name.clone());
    Some(Leaderboard { rating, winner })
}

fn get_player_score(p: &Player) -> u32 {
    p.money as u32
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, TypescriptDefinition, TypeScriptify)]
pub enum CargoDeliveryQuestState {
    Unknown = 0,
    Started = 1,
    Picked = 2,
    Delivered = 3,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Quest {
    pub id: Uuid,
    pub from_id: Uuid,
    pub to_id: Uuid,
    pub state: CargoDeliveryQuestState,
    pub reward: i32,
}

impl Quest {
    pub fn as_notification(&self, prng: &mut Pcg64Mcg) -> Notification {
        let text = format!("You've been tasked with delivering a cargo from one planet to another. Here's what you need:\n\n1. Pick up the cargo at s_cargo_source_planet.\n2. Drop off the cargo at s_cargo_destination_planet.\n\nYour employer, who wished to remain anonymous, will reward you: {} SB", self.reward);
        Notification::Task {
            header: "Delivery quest".to_string(),
            text: NotificationText {
                text,
                substituted: false,
                substitutions: vec![],
            },
            id: prng_id(prng),
        }
    }
}

pub fn update_quests(state: &mut GameState, prng: &mut Pcg64Mcg) {
    let quest_planets = state.locations[0].planets.clone();
    let mut any_new_quests = vec![];
    let player_ids = state.players.iter().map(|p| p.id).collect::<Vec<_>>();
    for player_id in player_ids {
        if let (Some(mut player), Some(ship)) = indexing::find_player_and_ship_mut(state, player_id)
        {
            if player.quest.is_none() {
                generate_random_quest(player, &quest_planets, ship.docked_at, prng);
                any_new_quests.push(player_id);
            } else {
                let quest_id = player.quest.as_ref().map(|q| q.id).unwrap();
                if !has_quest_item(&ship.inventory, quest_id)
                    && player.quest.as_ref().unwrap().state == CargoDeliveryQuestState::Picked
                {
                    player.quest = None;
                    log!(format!(
                        "Player {} has failed quest {} due to not having item",
                        player_id, quest_id
                    ));
                }
            }
        }
    }
    if any_new_quests.len() > 0 {
        substitute_notification_texts(state, HashSet::from_iter(any_new_quests));
    }
}
