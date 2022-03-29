use std::collections::HashMap;
use crate::{dialogue};
use crate::dialogue::DialogueStates;
use crate::pirate_defence;
use crate::indexing::{ObjectSpecifier};
use crate::world::{Planet, Player, Ship};
use crate::{cargo_rush, tutorial, world, GameMode, Vec2f64};
use dialogue::DialogueTable;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;
use wasm_bindgen::prelude::*;
use world::GameState;

use rand_pcg::Pcg64Mcg;
use rand::prelude::*;
use crate::indexing::{find_ship_index, find_ship_mut};

pub fn world_update_handle_event(
    state: &mut GameState,
    prng: &mut Pcg64Mcg,
    event: GameEvent,
    d_table: &DialogueTable,
) {
    match event {
        GameEvent::PirateSpawn { at, .. } => {
            pirate_defence::on_pirate_spawn(state, &at, prng);
        }
        GameEvent::DialogueTriggerRequest {
            dialogue_name,
            player_id,
        } => {
            if let Some(script) = d_table.get_by_name(dialogue_name.as_str()) {
                d_table.trigger_dialogue(script, player_id, state);
            } else {
                warn!(format!("No dialogue found by name {}", dialogue_name))
            }
        }
        GameEvent::ShipDocked {
            player_id,
            ship,
            planet,
            ..
        } => match state.mode {
            GameMode::Unknown => {}
            GameMode::CargoRush => {
                cargo_rush::on_ship_docked(state, player_id);
            }
            GameMode::Tutorial => {
                tutorial::on_ship_docked(state, player_id);
            }
            GameMode::Sandbox => {}
            GameMode::PirateDefence => {
                pirate_defence::on_ship_docked(state, ship, planet);
            }
        },
        GameEvent::ShipDied { ship, .. } => match state.mode {
            GameMode::Unknown => {}
            GameMode::CargoRush => {}
            GameMode::Tutorial => {}
            GameMode::Sandbox => {}
            GameMode::PirateDefence => pirate_defence::on_ship_died(state, ship),
        },

        GameEvent::Unknown => {
            // intentionally do nothing
        }
        GameEvent::ShipUndocked { .. } => {
            // do nothing for now, but may be game mode dependent
        }
        GameEvent::ShipSpawned { .. } => {
            // do nothing for now, but may be game mode dependent
        }
        GameEvent::RoomJoined { .. } => {
            // sever-only, do nothing
        }
        GameEvent::GameEnded { .. } => {
            // do nothing for now, but may be game mode dependent
        }
        GameEvent::GameStarted { .. } => {
            // do nothing for now, but may be game mode dependent
        }
        GameEvent::CargoQuestTriggerRequest { .. } => {
            // sever-only, do nothing - only for tutorial purposes
        }
        GameEvent::TradeDialogueTriggerRequest { ship_id, planet_id, .. } => {
            if let Some(ship) = find_ship_mut(state, ship_id) {
                ship.trading_with = Some(ObjectSpecifier::Planet { id: planet_id})
            }
        }
        GameEvent::CreateRoomRequest { .. } => {
            // sever-only, do nothing
        }
        GameEvent::QuitPlayerRequest { .. } => {
            // sever-only, do nothing
            // side effect for tutorial dialogue mostly
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum GameEvent {
    Unknown,
    ShipDocked {
        state_id: Uuid,
        ship: Ship,
        planet: Planet,
        player_id: Option<Uuid>,
    },
    ShipUndocked {
        state_id: Uuid,
        ship: Ship,
        planet: Planet,
        player_id: Option<Uuid>,
    },
    ShipSpawned {
        state_id: Uuid,
        ship: Ship,
        player_id: Option<Uuid>,
    },
    RoomJoined {
        personal: bool,
        mode: GameMode,
        player_id: Uuid,
    },
    ShipDied {
        state_id: Uuid,
        ship: Ship,
        player_id: Option<Uuid>,
    },
    GameEnded {
        state_id: Uuid,
    },
    GameStarted {
        state_id: Uuid,
    },
    CargoQuestTriggerRequest {
        player_id: Uuid,
    },
    TradeDialogueTriggerRequest {
        player_id: Uuid,
        ship_id: Uuid,
        planet_id: Uuid,
    },
    DialogueTriggerRequest {
        dialogue_name: String,
        player_id: Uuid,
    },
    PirateSpawn {
        at: Vec2f64,
        state_id: Uuid,
    },
    CreateRoomRequest {
        mode: GameMode,
        room_id: Uuid,
        bots_seed: Option<String>,
    },
    QuitPlayerRequest {
        player_id: Uuid,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub struct ProcessedGameEvent {
    pub event: GameEvent,
    pub processed_at_ticks: u64,
}
