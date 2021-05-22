use std::collections::HashMap;

use uuid::Uuid;

use crate::dialogue_dto::{Substitution, SubstitutionType};
use crate::inventory::{count_items_of_types, value_items_of_types, MINERAL_TYPES};
use crate::new_id;
use crate::random_stuff::gen_random_character_name;
use crate::world::{index_planets_by_id, index_players_by_id, GameState, Planet, Player, Ship};
use regex::{Captures, Match};
use std::mem;

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
                });
                inject_sub_text(&mut text_res, cap.get(0).clone(), current_planet.id);
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
                inject_sub_text(&mut text_res, cap.get(0).clone(), current_planet.id);
            } else {
                eprintln!("s_current_planet_body_type used without current planet");
            }
        } else if cap[0] == *"s_cargo_destination_planet" {
            if let Some(cargo_destination_planet) = players_by_id
                .get(&player_id)
                .and_then(|p| p.quest.clone())
                .and_then(|q| planets_by_id.get(&q.to_id))
            {
                let dest_planet = cargo_destination_planet.clone();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id: dest_planet.id,
                    text: cargo_destination_planet.name.clone(),
                });
                inject_sub_text(&mut text_res, cap.get(0).clone(), dest_planet.id);
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_cargo_source_planet" {
            if let Some(cargo_source_planet) = players_by_id
                .get(&player_id)
                .and_then(|p| p.quest.clone())
                .and_then(|q| planets_by_id.get(&q.from_id))
            {
                let source_planet = cargo_source_planet.clone();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id: source_planet.id,
                    text: cargo_source_planet.name.clone(),
                });
                inject_sub_text(&mut text_res, cap.get(0).clone(), source_planet.id);
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_random_name" {
            let uuid = new_id();
            sub_res.push(Substitution {
                s_type: SubstitutionType::CharacterName,
                id: uuid,
                text: gen_random_character_name().to_string(),
            });
            inject_sub_text(&mut text_res, cap.get(0).clone(), uuid);
        } else if cap[0] == *"s_minerals_amount" {
            if let Some(ship) = ships_by_player_id.get(&player_id) {
                let uuid = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id: uuid,
                    text: count_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec())
                        .to_string(),
                });
                inject_sub_text(&mut text_res, cap.get(0).clone(), uuid);
            } else {
                err!("s_minerals_amount used without ship");
            }
        } else if cap[0] == *"s_minerals_value" {
            if let Some(ship) = ships_by_player_id.get(&player_id) {
                let uuid = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id: uuid,
                    text: value_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec())
                        .to_string(),
                });
                inject_sub_text(&mut text_res, cap.get(0).clone(), uuid);
            } else {
                err!("s_minerals_value used without ship");
            }
        } else {
            eprintln!("Unknown substitution {}", cap[0].to_string());
        }
    }
    (sub_res, text_res)
}

fn inject_sub_text(target: &mut String, cap0: Option<Match>, injected_id: Uuid) {
    let cap0 = cap0.unwrap();
    let start = cap0.start();
    let end = cap0.end();
    let len = end - start;
    let injected_id_str = injected_id.to_string();
    let injected_id_bytes = injected_id_str.clone().into_bytes();
    let replaced_id_substr = (&injected_id_str[0..len]).to_string().into_bytes();
    let mut bytes = target.clone().into_bytes();
    // s_123123, so 2 characters has to be skipped and 2 less replaced
    // this code assumes that the substitution length is less than 36 (UUID length).
    for i in start..(end - 2) {
        bytes[i + 2] = replaced_id_substr[i - start]
    }
    for i in (len - 2)..injected_id_bytes.len() {
        bytes.insert(start + i + 2, injected_id_bytes[i]);
    }
    let mut joined = String::from_utf8(bytes).unwrap();
    eprintln!("Original {}, injected {}", target, joined);
    mem::swap(target, &mut joined);
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
                if !text.substituted {
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
                    text.substituted = true;
                }
            }
        }
    }
}
