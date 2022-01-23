use rand::prelude::SmallRng;
use uuid::Uuid;
use rand::Rng;
use crate::{fire_event, notifications, prng_id, Room, world};
use crate::bots;
use world::GameState;

use world::{GameEvent, Player};
use crate::api_struct::{AiTrait, new_bot};
use crate::bots::add_bot;
use crate::world::{CargoDeliveryQuestState, fire_saved_event, Planet, Quest};

pub fn on_create_room(room: &mut Room, prng: &mut SmallRng) {
    let traits = Some(vec![AiTrait::CargoRushHauler]);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(),prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(),prng_id(prng)), prng);
}

pub fn on_ship_docked(state: &mut GameState, player: Option<Player>) {
    if let Some(player) = player {
        fire_saved_event(state, GameEvent::DialogueTriggerRequest {
            dialogue_name: "basic_planet".to_owned(),
            player,
        });
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
