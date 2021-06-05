use crate::combat::ShootTarget;
use crate::vec2::Vec2f64;
use crate::world::{GameEvent, GameState, ManualMoveUpdate, Ship};
use crate::{combat, fire_event, tractoring, world};
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ShipActionRust {
    Unknown,
    Move(ManualMoveUpdate),
    Dock,
    Navigate(Vec2f64),
    DockNavigate(Uuid),
    Tractor(Uuid),
    Shoot(ShootTarget),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShipActionType {
    Unknown = 0,
    Move = 1,
    Dock = 2,
    Navigate = 3,
    DockNavigate = 4,
    Tractor = 5,
    Shoot = 6,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ShipAction {
    pub s_type: ShipActionType,
    pub data: String,
}

fn parse_ship_action(action_raw: ShipAction) -> ShipActionRust {
    match action_raw.s_type {
        ShipActionType::Unknown => ShipActionRust::Unknown,
        ShipActionType::Move => serde_json::from_str::<ManualMoveUpdate>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Move(v)),
        ShipActionType::Dock => ShipActionRust::Dock,
        ShipActionType::Navigate => serde_json::from_str::<Vec2f64>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Navigate(v)),
        ShipActionType::DockNavigate => serde_json::from_str::<Uuid>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::DockNavigate(v)),
        ShipActionType::Tractor => serde_json::from_str::<Uuid>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Tractor(v)),
        ShipActionType::Shoot => serde_json::from_str::<ShootTarget>(action_raw.data.as_str())
            .ok()
            .map_or(ShipActionRust::Unknown, |v| ShipActionRust::Shoot(v)),
    }
}

pub fn apply_ship_action(
    ship_action: ShipAction,
    state: &GameState,
    player_id: Uuid,
) -> Option<Ship> {
    let ship_action: ShipActionRust = parse_ship_action(ship_action);
    let ship_idx = world::find_my_ship_index(state, player_id);
    if ship_idx.is_none() {
        warn!("No ship");
        return None;
    }
    let ship_idx = ship_idx.unwrap();
    let old_ship = &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

    match ship_action {
        ShipActionRust::Unknown => {
            warn!("Unknown ship action");
            None
        }
        ShipActionRust::Move(v) => {
            let mut ship = old_ship.clone();
            ship.x = v.position.x;
            ship.y = v.position.y;
            ship.rotation = v.rotation;
            ship.navigate_target = None;
            ship.dock_target = None;
            ship.trajectory = vec![];
            Some(ship)
        }
        ShipActionRust::Dock => {
            let mut ship = old_ship.clone();
            ship.navigate_target = None;
            ship.dock_target = None;
            if ship.docked_at.is_some() {
                let planet_id = ship.docked_at.unwrap();
                let planet = world::find_planet(state, &planet_id).unwrap().clone();
                let player = world::find_my_player(state, player_id).unwrap().clone();
                ship.docked_at = None;
                fire_event(GameEvent::ShipUndocked {
                    ship: ship.clone(),
                    planet,
                    player,
                });
            } else {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                for planet in state.locations[ship_idx.location_idx].planets.iter() {
                    let pos = Vec2f64 {
                        x: planet.x,
                        y: planet.y,
                    };
                    if pos.euclidean_distance(&ship_pos) < planet.radius {
                        ship.docked_at = Some(planet.id);
                        ship.x = planet.x;
                        ship.y = planet.y;
                        ship.navigate_target = None;
                        ship.dock_target = None;
                        ship.trajectory = vec![];
                        let player = world::find_my_player(state, player_id).unwrap().clone();

                        fire_event(GameEvent::ShipDocked {
                            ship: ship.clone(),
                            player,
                            planet: planet.clone(),
                        });
                        break;
                    }
                }
            }
            Some(ship)
        }
        ShipActionRust::Navigate(v) => {
            let mut ship = old_ship.clone();
            let ship_pos = Vec2f64 {
                x: ship.x,
                y: ship.y,
            };

            ship.navigate_target = None;
            ship.dock_target = None;
            ship.docked_at = None;
            ship.navigate_target = Some(v);
            ship.trajectory = world::build_trajectory_to_point(ship_pos, &v);
            Some(ship)
        }
        ShipActionRust::DockNavigate(t) => {
            let mut ship = old_ship.clone();
            if let Some(planet) = world::find_planet(state, &t) {
                let ship_pos = Vec2f64 {
                    x: ship.x,
                    y: ship.y,
                };
                let planet_pos = Vec2f64 {
                    x: planet.x,
                    y: planet.y,
                };
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.docked_at = None;
                ship.dock_target = Some(t);
                ship.trajectory = world::build_trajectory_to_point(ship_pos, &planet_pos);
                Some(ship)
            } else {
                None
            }
        }
        ShipActionRust::Tractor(t) => {
            let mut ship = old_ship.clone();
            tractoring::update_ship_tractor(
                t,
                &mut ship,
                &state.locations[ship_idx.location_idx].minerals,
                &state.locations[ship_idx.location_idx].containers,
            );
            Some(ship)
        }
        ShipActionRust::Shoot(t) => {
            let mut ship = old_ship.clone();
            combat::commence_shoot(t, &mut ship, &state.locations[ship_idx.location_idx]);
            Some(ship)
        }
    }
}
