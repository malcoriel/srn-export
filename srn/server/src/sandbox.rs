use uuid::Uuid;
use crate::world::{GameState, find_my_ship, find_my_ship_mut};
use rand::rngs::SmallRng;
use rand::SeedableRng;
use chrono::Utc;
use crate::vec2::{Vec2f64};
use crate::system_gen::{gen_star, PlanetType};
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
        p_type: PlanetType
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
        SandboxCommand::AddPlanet { .. } => {}
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
