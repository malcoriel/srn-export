use crate::world::{GameState, Player};
use crate::world_events::{fire_saved_event, GameEvent};
use uuid::Uuid;

use crate::indexing::ObjectSpecifier;

pub fn on_ship_docked(_state: &mut GameState, _player_id: Option<Uuid>, _planet_id: Uuid) {
    // if let Some(player_id) = player_id {
    //     fire_saved_event(
    //         state,
    //         GameEvent::DialogueTriggerRequest {
    //             dialogue_name: "basic_planet".to_owned(),
    //             player_id,
    //             target: Some(ObjectSpecifier::Planet { id: planet_id }),
    //         },
    //     );
    // }
}
