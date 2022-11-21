use num_traits::real::Real;
use objekt_clonable::objekt::Clone;
use std::collections::HashMap;

use crate::api_struct::RoomId;
use crate::dialogue::Dialogue;
use crate::indexing::{find_my_player, find_player_location_idx};
use crate::world::{GameMode, GameState, Location, Ship};
use crate::world_events::GameEvent;
use crate::xcast::XCast;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct TagConfirm {
    pub tag: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ShipsWrapper {
    pub ships: Vec<Ship>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Wrapper<T> {
    pub value: T,
}

impl<T> Wrapper<T> {
    pub fn new(value: T) -> Self {
        Wrapper { value }
    }
}

#[derive(Debug, Clone)]
pub struct Pong {
    pub your_average_for_server: u32,
    pub target_player_id: Uuid,
}

#[derive(Debug, Clone)]
pub enum ServerToClientMessage {
    ObsoleteStateBroadcast(GameState),
    ObsoleteStateChangeExclusive(GameState, Uuid),
    TagConfirm(TagConfirm, Uuid),
    MulticastPartialShipUpdate(ShipsWrapper, Option<Uuid>, Uuid),
    DialogueStateChange(Wrapper<Option<Dialogue>>, Uuid, Uuid),
    XCastGameEvent(Wrapper<GameEvent>, XCast),
    XCastStateChange(GameState, XCast),
    RoomSwitched(XCast),
    RoomLeave(Uuid),
    Pong(Pong),
}

// actions in the server state will live a bit longer, but also will be cleaned up.
// see PROCESSED_ACTION_LIFETIME_TICKS
pub const MAX_PROCESSED_ACTIONS_SHARE_TIME_TICKS: f64 = 5.0 * 1000.0 * 1000.0;

pub fn patch_state_for_client_impl(mut state: GameState, player_id: Uuid) -> GameState {
    state.my_id = player_id;
    let player_loc_idx = find_player_location_idx(&state, player_id);
    let map_enough_info = state
        .locations
        .iter()
        .map(|l| {
            let mut res = Location::new_empty(l.id);
            res.star = l.star.clone();
            res.position = l.position;
            res.adjacent_location_ids = l.adjacent_location_ids.clone();
            return res;
        })
        .collect::<Vec<_>>();
    if let Some(loc_idx) = player_loc_idx {
        state.locations = vec![state.locations.into_iter().nth(loc_idx as usize).unwrap()];
    } else {
        // There must always be a location for client purposes for now.
        // The zero location can be some kind of limbo or just default location.
        state.locations = vec![state.locations.into_iter().nth(0).unwrap()];
    }
    let current_id = state.locations[0].id;
    state.locations.append(
        &mut map_enough_info
            .into_iter()
            .filter_map(|l| if l.id != current_id { Some(l) } else { None })
            .collect::<Vec<_>>(),
    );
    let current_ticks = state.ticks;
    state.events = Default::default();
    state.processed_events = Default::default();
    state.player_actions = Default::default();
    state.processed_player_actions = state
        .processed_player_actions
        .into_iter()
        .filter(|a| {
            (a.processed_at_ticks as f64 - current_ticks as f64).abs()
                < MAX_PROCESSED_ACTIONS_SHARE_TIME_TICKS
        })
        .collect();
    state.dialogue_states.retain(|k, _| *k == player_id);
    return state;
}

impl ServerToClientMessage {
    pub fn patch_for_client(self, client_id: Uuid) -> Self {
        match self {
            ServerToClientMessage::ObsoleteStateChangeExclusive(state, id) => {
                ServerToClientMessage::ObsoleteStateChangeExclusive(
                    patch_state_for_client_impl(state, client_id),
                    id,
                )
            }
            ServerToClientMessage::ObsoleteStateBroadcast(state) => {
                ServerToClientMessage::ObsoleteStateBroadcast(patch_state_for_client_impl(
                    state, client_id,
                ))
            }
            ServerToClientMessage::XCastStateChange(state, x_cast) => match x_cast {
                _ => ServerToClientMessage::XCastStateChange(
                    patch_state_for_client_impl(state, client_id),
                    x_cast,
                ),
            },
            m => m,
        }
    }
    pub fn serialize(&self) -> String {
        let (code, serialized) = match self {
            ServerToClientMessage::ObsoleteStateBroadcast(state) => {
                (1, serde_json::to_string(&state).unwrap())
            }
            ServerToClientMessage::ObsoleteStateChangeExclusive(state, _unused) => {
                (2, serde_json::to_string(&state).unwrap())
            }
            ServerToClientMessage::TagConfirm(tag_confirm, _unused) => {
                (3, serde_json::to_string(&tag_confirm).unwrap())
            }
            ServerToClientMessage::MulticastPartialShipUpdate(ships, _, _) => {
                (4, serde_json::to_string(ships).unwrap())
            }
            ServerToClientMessage::DialogueStateChange(dialogue, _, _) => {
                (5, serde_json::to_string(dialogue).unwrap())
            }
            ServerToClientMessage::XCastGameEvent(event, _) => {
                (6, serde_json::to_string(event).unwrap())
            }
            ServerToClientMessage::RoomSwitched(_) => (7, "".to_owned()),
            ServerToClientMessage::XCastStateChange(state, _) => {
                (8, serde_json::to_string(&state).unwrap())
            }
            ServerToClientMessage::RoomLeave(_) => (9, "".to_owned()),
            ServerToClientMessage::Pong(msg) => (10, msg.your_average_for_server.to_string()),
        };
        format!("{}_%_{}", code, serialized)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonalizeUpdate {
    pub name: String,
    pub portrait_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SwitchRoomPayload {
    pub room_id: RoomId,
    pub client_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientErr {
    pub message: String,
}

#[derive(FromPrimitive, ToPrimitive, Debug, Clone)]
pub enum ClientOpCode {
    Unknown = 0,
    Sync = 1,
    MutateMyShip = 2,
    Name = 3,
    DialogueOption = 4,
    SwitchRoom = 5,
    SandboxCommand = 6,
    TradeAction = 7,
    DialogueRequest = 8,
    InventoryAction = 9,
    ObsoleteLongActionStart = 10,
    ObsoleteRoomJoin = 11,
    NotificationAction = 12,
    SchedulePlayerAction = 13,
    SchedulePlayerActionBatch = 14,
    Ping = 15,
}
