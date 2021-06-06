use std::collections::{HashMap, HashSet};

use uuid::Uuid;

use crate::dialogue_dto::{Substitution, SubstitutionType};
use crate::inventory::{count_items_of_types, value_items_of_types, MINERAL_TYPES};
use crate::new_id;
use crate::random_stuff::gen_random_character_name;
use crate::world::{
    index_all_planets_by_id, index_all_ships_by_id, index_planets_by_id, index_players_by_id,
    index_ships_by_id, GameState, Planet, Player, Ship,
};
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
    let mut injects = vec![];
    for cap in re.captures_iter(text.as_str()) {
        if cap[0] == *"s_current_planet" {
            if let Some(current_planet) = players_to_current_planets.get(&player_id) {
                let id = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id,
                    text: current_planet.name.clone(),
                    target_id: Some(current_planet.id),
                });
                injects.push((cap.get(0).clone(), id));
            } else {
                eprintln!("s_current_planet used without current planet");
            }
        } else if cap[0] == *"s_current_planet_body_type" {
            if let Some(current_planet) = players_to_current_planets.get(&player_id) {
                let id = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id,
                    text: (if current_planet.anchor_tier == 1 {
                        "planet"
                    } else {
                        "moon"
                    })
                    .to_string(),
                    target_id: Some(current_planet.id),
                });
                injects.push((cap.get(0).clone(), id));
            } else {
                eprintln!("s_current_planet_body_type used without current planet");
            }
        } else if cap[0] == *"s_cargo_destination_planet" {
            if let Some(cargo_destination_planet) = players_by_id
                .get(&player_id)
                .and_then(|p| p.quest.clone())
                .and_then(|q| planets_by_id.get(&q.to_id))
            {
                let id = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id,
                    target_id: Some(cargo_destination_planet.id),
                    text: cargo_destination_planet.name.clone(),
                });
                injects.push((cap.get(0).clone(), id));
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_cargo_source_planet" {
            if let Some(cargo_source_planet) = players_by_id
                .get(&player_id)
                .and_then(|p| p.quest.clone())
                .and_then(|q| planets_by_id.get(&q.from_id))
            {
                let id = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::PlanetName,
                    id,
                    target_id: Some(cargo_source_planet.id),
                    text: cargo_source_planet.name.clone(),
                });
                injects.push((cap.get(0).clone(), id));
            } else {
                eprintln!("s_cargo_destination_planet used without destination planet!");
            }
        } else if cap[0] == *"s_random_name" {
            let uuid = new_id();
            sub_res.push(Substitution {
                s_type: SubstitutionType::CharacterName,
                id: uuid,
                text: gen_random_character_name().to_string(),
                target_id: None,
            });
            injects.push((cap.get(0).clone(), uuid));
        } else if cap[0] == *"s_minerals_amount" {
            if let Some(ship) = ships_by_player_id.get(&player_id) {
                let uuid = new_id();
                sub_res.push(Substitution {
                    s_type: SubstitutionType::Generic,
                    id: uuid,
                    text: count_items_of_types(&ship.inventory, &MINERAL_TYPES.to_vec())
                        .to_string(),
                    target_id: Some(ship.id),
                });
                injects.push((cap.get(0).clone(), uuid));
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
                    target_id: None,
                });
                injects.push((cap.get(0).clone(), uuid));
            } else {
                err!("s_minerals_value used without ship");
            }
        } else {
            eprintln!("Unknown substitution {}", cap[0].to_string());
        }
    }
    const ID_LENGTH: usize = 36;
    let mut accumulated_shift = 0;
    for inject in injects {
        let (cap, id) = inject;
        let cap = cap.unwrap();
        let cap_len = cap.as_str().len();
        assert!(cap_len < ID_LENGTH + 2);
        inject_sub_text(
            &mut text_res,
            cap.start() + accumulated_shift,
            cap.end() + accumulated_shift,
            id,
        );
        // Due to the difference in length, the moment first cap is replaced,
        // all other locations become invalid.
        // To combat it, we 'shift' everything to the right by the diff.
        let diff = ID_LENGTH + 2 - cap_len;
        accumulated_shift += diff;
    }
    (sub_res, text_res)
}

fn inject_sub_text(target: &mut String, start: usize, end: usize, injected_id: Uuid) {
    //eprintln!("inject {} start {} end {}", target, start, end);
    let len = end - start;
    let injected_id_str = injected_id.to_string();
    let injected_id_bytes = injected_id_str.clone().into_bytes();
    let replaced_id_substr = (&injected_id_str[0..len]).to_string().into_bytes();
    let mut bytes = target.clone().into_bytes();
    // s_123123, so 2 characters has to be skipped and 2 less replaced
    for i in start..(end - 2) {
        bytes[i + 2] = replaced_id_substr[i - start]
    }
    for i in (len - 2)..injected_id_bytes.len() {
        bytes.insert(start + i + 2, injected_id_bytes[i]);
    }
    let mut joined = String::from_utf8(bytes).unwrap();
    mem::swap(target, &mut joined);
}

pub fn substitute_notification_texts(state: &mut GameState, player_ids: HashSet<Uuid>) {
    let indexed_state = state.clone();

    let players_to_update = state
        .players
        .iter_mut()
        .filter(|p| player_ids.contains(&p.id))
        .collect::<Vec<_>>();

    if players_to_update.len() == 0 {
        return;
    }

    let (planets_by_id, players_by_id, players_to_current_planets, ships_by_player_id, _) =
        index_state_for_substitution(&indexed_state);

    for player in players_to_update.into_iter() {
        for not in player.notifications.iter_mut() {
            if let Some(text) = not.get_text_mut() {
                if !text.substituted {
                    let (sub_res, text_res) = substitute_text(
                        &text.text,
                        player.id,
                        &players_to_current_planets,
                        &players_by_id,
                        &planets_by_id,
                        &ships_by_player_id,
                    );
                    text.text = text_res;
                    text.substitutions = sub_res;
                    text.substituted = true;
                }
            }
        }
    }
}

pub fn index_state_for_substitution(
    state: &GameState,
) -> (
    HashMap<Uuid, &Planet>,
    HashMap<Uuid, &Player>,
    HashMap<Uuid, &Planet>,
    HashMap<Uuid, &Ship>,
    HashMap<Uuid, &Ship>,
) {
    let planets_by_id = index_all_planets_by_id(&state.locations);
    let players_state_clone = &state.players;
    let players_by_id = index_players_by_id(&players_state_clone);
    let mut players_to_current_planets = HashMap::new();
    let mut ships_by_player_id = HashMap::new();
    let ships_by_id = index_all_ships_by_id(&state.locations);

    for player in state.players.iter() {
        if let Some(ship_id) = player.ship_id {
            if let Some(ship) = ships_by_id.get(&ship_id) {
                ships_by_player_id.insert(ship_id, *ship);
                if let Some(docked_at) = ship.docked_at {
                    if let Some(planet) = planets_by_id.get(&docked_at) {
                        players_to_current_planets.insert(player.id, *planet);
                    }
                }
            }
        }
    }

    (
        planets_by_id,
        players_by_id,
        players_to_current_planets,
        ships_by_player_id,
        ships_by_id,
    )
}
