use uuid::Uuid;
use crate::random_stuff::{PLANET_NAMES};
use crate::world::{GameState, find_my_ship, find_my_ship_mut};
use rand::rngs::SmallRng;
use rand::SeedableRng;
use chrono::Utc;
use crate::vec2::{Vec2f64};
use crate::system_gen::{gen_star, PlanetType, gen_planet_typed, PoolRandomPicker};
use crate::new_id;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum SandboxTeleportTarget {
    Unknown,
    Zero
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum SandboxCommand {
    AddStar,
    ToggleGodMode,
    AddPlanet {
        p_type: PlanetType,
        orbit_speed: f64,
        radius: f64,
        anchor_id: Uuid
    },
    Teleport {
        target: SandboxTeleportTarget
    }
}


fn get_pos(state: &mut GameState, player_id:Uuid) -> Option<Vec2f64> {
    let ship = find_my_ship(state, player_id);
    ship.map(|s| Vec2f64 {
        x: s.x,
        y: s.y
    })
}

pub fn mutate_state(state: &mut GameState, player_id: Uuid, cmd: SandboxCommand) {
    let mut prng = SmallRng::seed_from_u64(Utc::now().timestamp_millis() as u64);
    match cmd {
        SandboxCommand::AddStar => {
            if let Some(pos) = get_pos(state, player_id) {
                state.star = Some(gen_star(new_id(), &mut prng, 50.0, pos))
            }
        }
        SandboxCommand::ToggleGodMode => {
            state.disable_hp_effects = !state.disable_hp_effects;
        }
        SandboxCommand::AddPlanet { p_type, orbit_speed, radius, anchor_id } => {
            if let Some(pos) = get_pos(state, player_id) {
                let mut planet_name_pool = PoolRandomPicker {
                    // TODO filter out existing planets
                    options: Vec::from(PLANET_NAMES),
                };
                let name = planet_name_pool.get(&mut prng).to_string();
                let mut planet = gen_planet_typed(p_type);
                planet.name = name;
                planet.radius = radius;
                planet.orbit_speed = orbit_speed;
                planet.anchor_id = anchor_id;
                planet.anchor_tier = get_anchor_tier(state, anchor_id);
                planet.x = pos.x;
                planet.y = pos.y;
                state.planets.push(planet);
            }

        }
        SandboxCommand::Teleport { target } => {
            if target == SandboxTeleportTarget::Zero {
                if let Some(ship) = find_my_ship_mut(state, player_id) {
                    ship.x = 0.0;
                    ship.y = 0.0;
                }
            }
        }
    }
}

fn get_anchor_tier(state: &mut GameState, anchor_id: Uuid) -> u32 {
    let anchor_planet = state.planets.iter().find(|p| p.id == anchor_id);
    if anchor_planet.is_none() {
        if let Some(star) = state.star.as_ref() {
            if star.id == anchor_id {
                return 1;
            }
        }
        return 0;
    }
    let anchor_planet = anchor_planet.unwrap();
    return anchor_planet.anchor_tier + 1;
}
