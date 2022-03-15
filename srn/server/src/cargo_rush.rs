use crate::{bots, fire_event, notifications, prng_id, world, Room};
use itertools::Itertools;
use rand::prelude::SmallRng;
use rand::Rng;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use world::GameState;

use crate::api_struct::{new_bot, AiTrait};
use crate::bots::add_bot;
use crate::notifications::{Notification, NotificationText};
use crate::world::{fire_saved_event, Leaderboard, Planet};
use crate::world_events::GameEvent;
use world::Player;

pub fn on_create_room(room: &mut Room, prng: &mut SmallRng) {
    let traits = Some(vec![AiTrait::CargoRushHauler]);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
}

pub fn on_ship_docked(state: &mut GameState, player_id: Option<Uuid>) {
    if let Some(player_id) = player_id {
        fire_saved_event(
            state,
            GameEvent::DialogueTriggerRequest {
                dialogue_name: "basic_planet".to_owned(),
                player_id,
            },
        );
    }
}

pub fn generate_random_quest(
    player: &mut Player,
    planets: &Vec<Planet>,
    docked_at: Option<Uuid>,
    prng: &mut SmallRng,
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
    pub fn as_notification(&self, prng: &mut SmallRng) -> Notification {
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
