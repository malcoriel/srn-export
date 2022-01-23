use rand::prelude::SmallRng;
use crate::{cargo_rush, GameMode, world, tutorial};
use crate::dialogue;
use dialogue::{DialogueTable};
use crate::pirate_defence;
use world::{GameEvent, GameState};
use crate::dialogue::DialogueStates;

pub fn world_update_handle_event(state: &mut GameState, prng: &mut SmallRng, event: GameEvent, d_states: &mut DialogueStates, d_table: &DialogueTable) {
    match event {
        GameEvent::PirateSpawn { at, .. } => {
            pirate_defence::on_pirate_spawn(state, &at, prng);
        }
        GameEvent::DialogueTriggerRequest { dialogue_name, player } => {
            if let Some(script) = d_table.get_by_name(dialogue_name.as_str()) {
                let d_states = DialogueTable::get_player_d_states(d_states, &player);
                // this variable is useless here, it was previously needed for unicasting the changes back to clients
                let mut dialogue_changes = vec![];
                d_table.trigger_dialogue(
                    script,
                    &mut dialogue_changes,
                    &player,
                    d_states,
                    state,
                )
            } else {
                warn!(format!("No dialogue found by name {}", dialogue_name))
            }
        }
        GameEvent::ShipDocked { player, ship, planet, .. } => {
            match state.mode {
                GameMode::Unknown => {}
                GameMode::CargoRush => {
                    cargo_rush::on_ship_docked(state, player);
                }
                GameMode::Tutorial => {
                    tutorial::on_ship_docked(state, player);
                }
                GameMode::Sandbox => {}
                GameMode::PirateDefence => {
                    pirate_defence::on_ship_docked(state, ship, planet);
                }
            }
        }
        GameEvent::ShipDied { ship, ..} => {
            match state.mode {
                GameMode::Unknown => {}
                GameMode::CargoRush => {}
                GameMode::Tutorial => {}
                GameMode::Sandbox => {}
                GameMode::PirateDefence => {
                    pirate_defence::on_ship_died(state, ship)
                }
            }
        }
        _ => {}
    }
}
