use std::collections::HashMap;

use uuid::Uuid;

use crate::dialogue_dto::{Substitution, SubstitutionType};
use crate::inventory::{count_items_of_types, value_items_of_types, MINERAL_TYPES};
use crate::new_id;
use crate::random_stuff::gen_random_character_name;
use crate::world::{index_planets_by_id, index_players_by_id, GameState, Planet, Player, Ship};

pub fn substitute_text(
    text: &String,
    player_id: Uuid,
    players_to_current_planets: &HashMap<Uuid, &Planet>,
    players_by_id: &HashMap<Uuid, &Player>,
    planets_by_id: &HashMap<Uuid, &Planet>,
    ships_by_player_id: &HashMap<Uuid, &Ship>,
) -> (Vec<Substitution>, String) {
    let mut text_res = text.clone();
    let mut sub_res = vec![];
    let re = &crate::SUB_RE;
    for cap in re.captures_iter(text.as_str()) {
        if cap[0] == *"s_current_planet" {
            if let Some(current_planet) = players_to_current_planets.get(&player_id) {
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id: current_planet.id,
                    text: current_planet.name.clone(),
                })
            } else {
                eprintln!("s_current_planet used without current planet");
            }
        } else if cap[0] == *"s_current_planet_body_type" {
            if let Some(current_planet) = players_to_current_planets.get(&player_id) {
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id: current_planet.id,
                    text: (if current_planet.anchor_tier == 1 {
                        "planet"
                    } else {
                        "moon"
                    })
                    .to_string(),
                });
            } else {
                eprintln!("s_current_planet_body_type used without current planet");
            }
        } else if cap[0] == *"s_cargo_destination_planet" {
            if let Some(cargo_destination_planet) = players_by_id
                .get(&player_id)
                .and_then(|p| p.quest.clone())
                .and_then(|q| planets_by_id.get(&q.to_id))
            {
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id: cargo_destination_planet.clone().id,
                    text: cargo_destination_planet.name.clone(),
                });
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_cargo_source_planet" {
            if let Some(cargo_source_planet) = players_by_id
                .get(&player_id)
                .and_then(|p| p.quest.clone())
                .and_then(|q| planets_by_id.get(&q.from_id))
            {
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id: cargo_source_planet.clone().id,
                    text: cargo_source_planet.name.clone(),
                });
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_random_name" {
            sub_res.push(Substitution {
                s_type: SubstitutionType::CharacterName,
                id: new_id(),
                text: gen_random_character_name().to_string(),
            });
        } else if cap[0] == *"s_minerals_amount" {
            if let Some(ship) = ships_by_player_id.get(&player_id) {
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id: new_id(),
                    text: count_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec())
                        .to_string(),
                });
            } else {
                err!("s_minerals_amount used without ship");
            }
        } else if cap[0] == *"s_minerals_value" {
            if let Some(ship) = ships_by_player_id.get(&player_id) {
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id: new_id(),
                    text: value_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec())
                        .to_string(),
                });
            } else {
                err!("s_minerals_value used without ship");
            }
        } else {
            eprintln!("Unknown substitution {}", cap[0].to_string());
        }
    }
    (sub_res, text_res)
}

pub fn substitute_notification_texts(state: &mut GameState, player_id: Option<Uuid>) {
    let mut all_planets = vec![];
    for mut loc in state.locations.clone().into_iter() {
        all_planets.append(&mut loc.planets);
    }
    let planets_by_id = index_planets_by_id(&all_planets);
    let players_state_clone = state.players.clone();
    let players_by_id = index_players_by_id(&players_state_clone);
    for player in state
        .players
        .iter_mut()
        .filter(|p| player_id.map_or(true, |player_id| player_id == p.id))
    {
        for not in player.notifications.iter_mut() {
            if let Some(text) = not.get_text_mut() {
                let (sub_res, text_res) = substitute_text(
                    &text.text,
                    player.id,
                    &HashMap::new(),
                    &players_by_id,
                    &planets_by_id,
                    &HashMap::new(),
                );
                text.text = text_res;
                text.substitutions = sub_res;
            }
        }
    }
}
