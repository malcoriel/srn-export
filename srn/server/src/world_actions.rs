use crate::abilities::Ability;
use crate::dialogue::{execute_dialog_option, DialogueTable, DialogueUpdate};
use crate::indexing::ObjectSpecifier;
use crate::indexing::{
    find_my_ship_mut, find_player_idx_by_ship_id, find_ship_index, find_ship_mut, GameStateIndexes,
};
use crate::inventory::InventoryAction;
use crate::long_actions::{try_start_long_action, try_start_long_action_ship, LongActionStart};
use crate::market::TradeAction;
use crate::notifications::NotificationActionR;
use crate::sandbox::SandboxCommand;
use crate::world::{
    fire_saved_event, undock_ship, update_ship_manual_movement, GameState, ManualMoveUpdate,
    ObjectProperty, PlayerId, Ship, ShipWithTime,
};
use crate::world_events::GameEvent;
use crate::{
    fire_event, indexing, inventory, market, notifications, tractoring, trajectory, Vec2f64,
};
use rand::prelude::*;
use rand_pcg::Pcg64Mcg;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

const MAX_ALLOWED_DISTANCE_TICKS: i64 = 10 * 1000 * 1000;

pub fn world_update_handle_action(
    state: &mut GameState,
    action: Action,
    prng: &mut Pcg64Mcg,
    // potentially can be optimized further to avoid cloning here
    state_clone: &GameState,
    d_table: &DialogueTable,
    _happened_at_ticks: Option<u64>,
    _client: bool,
) {
    // let current_ticks = state.ticks;
    match action {
        Action::LongActionStart {
            long_action_start,
            player_id,
            ship_id,
        } => {
            if let Some(player_id) = player_id {
                try_start_long_action(state, player_id, long_action_start, prng);
            } else {
                if let Some(ship_idx) = find_ship_index(state_clone, ship_id) {
                    try_start_long_action_ship(state, &ship_idx, long_action_start, prng);
                }
            }
        }
        Action::Gas { ship_id, .. } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
                // if let Some(happened_at_ticks) = happened_at_ticks {
                //     let diff = current_ticks - happened_at_ticks;
                //     if diff > 0 && !client {
                //         warn!(format!(
                //             "diff apply {} = server {} - client {}",
                //             diff, current_ticks, happened_at_ticks
                //         ));
                //         update_ship_manual_movement(
                //             diff as i64,
                //             current_ticks as u32,
                //             ship,
                //             false,
                //             true,
                //         );
                //     }
                // }
            }
        }
        Action::StopGas { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.gas = None;
            }
        }
        Action::Reverse { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.gas = Some(MoveAxisParam {
                    forward: false,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::TurnRight { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.turn = Some(MoveAxisParam {
                    forward: false,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::TurnLeft { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.turn = Some(MoveAxisParam {
                    forward: true,
                    last_tick: state_clone.millis,
                });
                ship.navigate_target = None;
                ship.dock_target = None;
                ship.trajectory = vec![];
            }
        }
        Action::StopTurn { ship_id } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.movement_markers.turn = None;
            }
        }
        Action::Navigate { ship_id, target } => {
            if let Some(idx) = find_ship_index(state_clone, ship_id) {
                undock_ship(
                    state,
                    idx.clone(),
                    false, // technically this code is used on both server & client, but
                    // I know that there are only fire-event side effects that do nothing on client
                    find_player_idx_by_ship_id(state_clone, ship_id),
                    prng,
                );
                let mut ship = &mut state.locations[idx.location_idx].ships[idx.ship_idx];
                let ship_pos = ship.as_vec();
                ship.dock_target = None;
                ship.navigate_target = Some(target);
                ship.trajectory = trajectory::build_trajectory_to_point(
                    ship_pos,
                    &target,
                    &ship.movement_definition,
                    state.update_every_ticks,
                );
                ship.movement_markers.gas = None;
                ship.movement_markers.turn = None;
            }
        }
        Action::DockNavigate { ship_id, target } => {
            if let Some(ship_idx) = find_ship_index(state, ship_id) {
                let ship = &state_clone.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

                if let Some(planet) = indexing::find_planet(state_clone, &target) {
                    if planet
                        .properties
                        .contains(&ObjectProperty::UnlandablePlanet)
                        && !ship.abilities.contains(&Ability::BlowUpOnLand)
                    {
                        // technically some logic bug signifier, but it also conflicts with one of the test hacks
                        // in 'can start long action TransSystemJump' test
                        // warn!(format!(
                        //     "Attempt to land on unlandable planet {} by ship {}, ignoring.",
                        //     planet.id, ship.id
                        // ));
                    } else {
                        undock_ship(
                            state,
                            ship_idx.clone(),
                            false, // same reasoning as with Navigate
                            find_player_idx_by_ship_id(state_clone, ship.id),
                            prng,
                        );
                        let ship =
                            &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];

                        let ship_pos = ship.as_vec();
                        let planet_pos = Vec2f64 {
                            x: planet.spatial.position.x,
                            y: planet.spatial.position.y,
                        };

                        ship.navigate_target = None;
                        ship.dock_target = None;
                        ship.dock_target = Some(target);
                        ship.trajectory = trajectory::build_trajectory_to_point(
                            ship_pos,
                            &planet_pos,
                            &ship.movement_definition,
                            state.update_every_ticks,
                        );
                        ship.movement_markers.gas = None;
                        ship.movement_markers.turn = None;
                    }
                }
            }
        }
        Action::Tractor { target, ship_id } => {
            if let Some(ship_idx) = find_ship_index(state, ship_id) {
                let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
                tractoring::update_ship_tractor(
                    target,
                    ship,
                    &state_clone.locations[ship_idx.location_idx].minerals,
                    &state_clone.locations[ship_idx.location_idx].containers,
                );
            }
        }
        Action::SelectDialogueOption {
            player_id,
            option_id,
            dialogue_id,
        } => {
            execute_dialog_option(
                player_id,
                state,
                DialogueUpdate {
                    dialogue_id,
                    option_id,
                },
                d_table,
                prng,
            );
        }
        Action::RequestDialogue {
            player_id,
            planet_id,
        } => fire_saved_event(
            state,
            GameEvent::DialogueTriggerRequest {
                dialogue_name: "basic_planet".to_string(),
                target: Some(ObjectSpecifier::Planet { id: planet_id }),
                player_id,
            },
        ),
        Action::CancelTrade { player_id } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                ship.trading_with = None;
            }
        }
        Action::Inventory { player_id, action } => {
            if let Some(ship) = find_my_ship_mut(state, player_id) {
                inventory::apply_action(&mut ship.inventory, action);
            }
        }
        Action::SandboxCommand { player_id, command } => {
            fire_saved_event(
                state,
                GameEvent::SandboxCommandRequest { player_id, command },
            );
        }
        Action::Notification { player_id, action } => {
            notifications::apply_action(state, player_id, action);
        }
        Action::Trade { player_id, action } => {
            market::attempt_trade(state, player_id, action, prng);
        }
        _ => {
            warn!(format!(
                "action {:?} cannot be handled by world_update_handle_player_action",
                action
            ))
        }
    }
}

pub fn is_world_update_action(act: &Action) -> bool {
    matches!(
        act,
        Action::LongActionStart { .. }
            | Action::Navigate { .. }
            | Action::Gas { .. }
            | Action::StopGas { .. }
            | Action::Reverse { .. }
            | Action::TurnLeft { .. }
            | Action::TurnRight { .. }
            | Action::StopTurn { .. }
            | Action::DockNavigate { .. }
            | Action::Tractor { .. }
            | Action::SelectDialogueOption { .. }
            | Action::RequestDialogue { .. }
            | Action::CancelTrade { .. }
            | Action::Inventory { .. }
            | Action::Notification { .. }
            | Action::SandboxCommand { .. }
            | Action::Trade { .. }
    )
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum Action {
    Unknown,
    Move {
        update: ManualMoveUpdate,
    },
    Gas {
        ship_id: Uuid,
    },
    StopGas {
        ship_id: Uuid,
    },
    StopTurn {
        ship_id: Uuid,
    },
    Reverse {
        ship_id: Uuid,
    },
    TurnRight {
        ship_id: Uuid,
    },
    TurnLeft {
        ship_id: Uuid,
    },
    Dock,
    Navigate {
        ship_id: Uuid,
        target: Vec2f64,
    },
    DockNavigate {
        ship_id: Uuid,
        target: Uuid,
    },
    Tractor {
        ship_id: Uuid,
        target: Uuid,
    },
    LongActionStart {
        long_action_start: LongActionStart,
        player_id: Option<Uuid>,
        ship_id: Uuid,
    },
    SelectDialogueOption {
        player_id: Uuid,
        option_id: Uuid,
        dialogue_id: Uuid,
    },
    RequestDialogue {
        planet_id: Uuid,
        player_id: Uuid,
    },
    CancelTrade {
        player_id: Uuid,
    },
    Inventory {
        player_id: Uuid,
        action: InventoryAction,
    },
    Notification {
        player_id: Uuid,
        action: NotificationActionR,
    },
    SandboxCommand {
        player_id: Uuid,
        command: SandboxCommand,
    },
    Trade {
        player_id: Uuid,
        action: TradeAction,
    },
}

impl Action {
    pub fn is_for_client(&self, my_ship_id: Option<Uuid>, my_player_id: PlayerId) -> bool {
        match self {
            Action::Unknown => false,
            Action::Move { .. } => false, // obsolete anyway
            Action::Gas { ship_id } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::StopGas { ship_id } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::StopTurn { ship_id } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::Reverse { ship_id } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::TurnRight { ship_id } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::TurnLeft { ship_id } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::Dock => false, // obsolete and unused
            Action::Navigate { ship_id, .. } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::DockNavigate { ship_id, .. } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::Tractor { ship_id, .. } => my_ship_id.map_or(false, |sid| sid == *ship_id),
            Action::LongActionStart { ship_id, .. } => {
                my_ship_id.map_or(false, |sid| sid == *ship_id)
            }
            Action::SelectDialogueOption { player_id, .. } => *player_id == my_player_id,
            Action::RequestDialogue { player_id, .. } => *player_id == my_player_id,
            Action::CancelTrade { player_id, .. } => *player_id == my_player_id,
            Action::Inventory { player_id, .. } => *player_id == my_player_id,
            Action::Notification { player_id, .. } => *player_id == my_player_id,
            Action::SandboxCommand { player_id, .. } => *player_id == my_player_id,
            Action::Trade { player_id, .. } => *player_id == my_player_id,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct MoveAxisParam {
    pub forward: bool,
    pub last_tick: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct ShipMovementMarkers {
    pub gas: Option<MoveAxisParam>,
    pub turn: Option<MoveAxisParam>,
}

impl ShipMovementMarkers {
    pub fn new() -> Self {
        Self {
            gas: None,
            turn: None,
        }
    }
}

impl Default for ShipMovementMarkers {
    fn default() -> Self {
        ShipMovementMarkers::new()
    }
}
