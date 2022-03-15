use crate::bots;
use crate::{fire_event, notifications, prng_id, world, Room};
use rand::prelude::SmallRng;
use rand::Rng;
use uuid::Uuid;
use world::GameState;

use crate::api_struct::{new_bot, AiTrait};
use crate::bots::add_bot;
use crate::world::{fire_saved_event, CargoDeliveryQuestState, Planet, Quest};
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
