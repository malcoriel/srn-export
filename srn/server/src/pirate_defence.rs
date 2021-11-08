use crate::abilities::Ability;
use crate::vec2::Vec2f64;
use crate::{fire_event, indexing, world};
use crate::api_struct::AiTrait;
use crate::world::{GameState, Ship, GameEvent, GameOver, Planet, SpawnShipTemplate};

pub fn on_pirate_spawn(state: &mut GameState, at: Vec2f64) {
      world::spawn_ship(state, None, SpawnShipTemplate::pirate(Some(at)));
}

const SHIP_PLANET_HIT_NORMALIZED : f64 = 0.1;

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
