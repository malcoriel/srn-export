use std::f64::consts::PI;

use rand::Rng;

use crate::api_struct::{new_bot, Room};
use crate::bots::add_bot;
use crate::{fire_event, indexing, world};
use crate::abilities::Ability;
use crate::api_struct::AiTrait;
use crate::vec2::Vec2f64;
use crate::world::{fire_saved_event, GameEvent, GameOver, GameState, ObjectProperty, Planet, Ship, ShipTemplate, TimeMarks};
use crate::get_prng;
use crate::indexing::{index_players_by_ship_id, ObjectSpecifier};

pub fn on_pirate_spawn(state: &mut GameState, at: &Vec2f64) {
      world::spawn_ship(state, None, ShipTemplate::pirate(Some(at.clone())));
}

const SHIP_PLANET_HIT_NORMALIZED : f64 = 0.1;
const PIRATE_SPAWN_DIST: f64 = 100.0;
const PIRATE_SPAWN_COUNT: usize = 3;
const PIRATE_SPAWN_INTERVAL_TICKS: u32 = 10 * 1000 * 1000;

pub fn on_ship_docked(state: &mut GameState, ship: Ship, planet: Planet) {
    if ship.abilities.iter().any(|a| matches!(a, Ability::BlowUpOnLand)) {
        // remove ship immediately
        indexing::find_and_extract_ship_by_id(state, ship.id);
        if let Some(planet) = indexing::find_planet_mut(state, &planet.id) {
            if let Some(health) = &mut planet.health {
                health.current = (health.current - health.max * SHIP_PLANET_HIT_NORMALIZED).max(0.0);
                if health.current <= 0.0 {
                    state.game_over = Some(GameOver {
                        reason: format!("Your planet {} was captured by pirates. All is lost, and you have been defeated.", planet.name),
                    })
                }
            }
        }
    }
}

pub fn on_ship_died(state: &mut GameState, ship: Ship) {
    if let Some(prop) = ship.properties.iter().find(|a| matches!(a, ObjectProperty::MoneyOnKill { .. })) {
        match prop {
            ObjectProperty::MoneyOnKill { amount } => {
                if let Some(killer) = ship.health.last_damage_dealer {
                    let player_id = match killer {
                        ObjectSpecifier::Ship { id } => {
                            let mapping = index_players_by_ship_id(&state.players);
                            if let Some(player) = mapping.get(&id) {
                                Some(player.id)
                            } else {
                                None
                            }
                        }
                        _ => {
                            None
                        }
                    };
                    if let Some(player_id) = player_id {
                        if let Some(player) = state.players.iter_mut().find(|p| p.id == player_id) {
                            player.money += amount;
                        }
                    }
                }
            }
            _ => {}
        }

    }
}

pub fn update_state_pirate_defence(state: &mut GameState) {
    let current_ticks = state.millis * 1000;
    if world::every(
        PIRATE_SPAWN_INTERVAL_TICKS,
        current_ticks,
        state.interval_data.get(&TimeMarks::PirateSpawn).map(|m| *m),
    ) {
        state
            .interval_data
            .insert(TimeMarks::PirateSpawn, current_ticks);
        for _i in 0..PIRATE_SPAWN_COUNT * state.players.len() {
            fire_saved_event(state, GameEvent::PirateSpawn {
                state_id: state.id,
                at: gen_pirate_spawn(&state.locations[0].planets.get(0).unwrap()),
            });
        }

    }
}

pub fn gen_pirate_spawn(planet: &Planet) -> Vec2f64 {
    let angle = get_prng().gen_range(0.0, PI * 2.0);
    let vec = Vec2f64 { x: 1.0, y: 0.0 };
    vec.rotate(angle)
        .scalar_mul(PIRATE_SPAWN_DIST)
        .add(&Vec2f64 {
            x: planet.x,
            y: planet.y,
        })
}

pub fn on_create_room(room: &mut Room) {
    add_bot(room, new_bot(Some(vec![AiTrait::PirateDefenceDefender])));
}
