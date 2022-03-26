use std::collections::HashMap;
use crate::dialogue;
use crate::dialogue::DialogueStates;
use crate::pirate_defence;
use crate::world::{Planet, Player, Ship};
use crate::{cargo_rush, tutorial, world, GameMode, Vec2f64};
use dialogue::DialogueTable;
use rand::prelude::SmallRng;
use serde_derive::{Deserialize, Serialize};
use uuid::Uuid;
use wasm_bindgen::prelude::*;
use world::GameState;

pub fn world_update_handle_event(
    state: &mut GameState,
    prng: &mut SmallRng,
    event: GameEvent,
    d_states: &mut DialogueStates,
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
                let (current_player_dialogue, player_d_states) =
                    d_states.entry(player_id).or_insert((None, HashMap::new()));
                // this variable is useless here, it was previously needed for unicasting the changes back to clients
                let mut dialogue_changes = vec![];
                d_table.trigger_dialogue(script, &mut dialogue_changes, player_id, player_d_states, state);
                // rewrite the player's dialogues with the updated version
                state.dialogue_states.insert(player_id, (current_player_dialogue.clone(), player_d_states.clone()));
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
        GameEvent::TradeDialogueTriggerRequest { .. } => {
            // sever-only, do nothing
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
