use std::f64::consts::PI;

use rand::Rng;

use crate::{fire_event, indexing, world};
use crate::abilities::Ability;
use crate::api_struct::AiTrait;
use crate::vec2::Vec2f64;
use crate::world::{GameEvent, GameOver, GameState, Planet, Ship, ShipTemplate, TimeMarks};

pub fn on_pirate_spawn(state: &mut GameState, at: Vec2f64) {
      world::spawn_ship(state, None, ShipTemplate::pirate(Some(at)));
}

const SHIP_PLANET_HIT_NORMALIZED : f64 = 0.1;
const PIRATE_SPAWN_DIST: f64 = 100.0;
const PIRATE_SPAWN_COUNT: usize = 3;
const PIRATE_SPAWN_INTERVAL_TICKS: u32 = 10 * 1000 * 1000;

pub fn on_ship_land(state: &mut GameState, ship: Ship, planet: Planet) {
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
            fire_event(GameEvent::PirateSpawn {
                state_id: state.id,
                at: gen_pirate_spawn(&state.locations[0].planets.get(0).unwrap()),
            });
        }

    }
}

pub fn gen_pirate_spawn(planet: &Planet) -> Vec2f64 {
    let angle = world::gen_rng().gen_range(0.0, PI * 2.0);
    let vec = Vec2f64 { x: 1.0, y: 0.0 };
    vec.rotate(angle)
        .scalar_mul(PIRATE_SPAWN_DIST)
        .add(&Vec2f64 {
            x: planet.x,
            y: planet.y,
        })
}
