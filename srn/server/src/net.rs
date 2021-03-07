use uuid::Uuid;

use crate::dialogue::Dialogue;
use crate::world::{GameEvent, GameState, Ship, GameMode};
use crate::xcast::XCast;

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
}

pub fn patch_state_for_player(mut state: GameState, player_id: Uuid) -> GameState {
    state.my_id = player_id;
    state
}

impl ServerToClientMessage {
    pub fn patch_with_id(self, client_id: Uuid) -> Self {
        match self {
            ServerToClientMessage::ObsoleteStateChangeExclusive(state, id) => {
                ServerToClientMessage::ObsoleteStateChangeExclusive(
                    patch_state_for_player(state, client_id),
                    id,
                )
            }
            ServerToClientMessage::ObsoleteStateBroadcast(state) => {
                ServerToClientMessage::ObsoleteStateBroadcast(patch_state_for_player(state, client_id))
            }
            ServerToClientMessage::XCastStateChange(state, x_cast) => {
                match x_cast {
                    XCast::Unicast(_, target_id) => {
                        ServerToClientMessage::XCastStateChange(patch_state_for_player(state, target_id), x_cast)
                    }
                    _ => {
                        ServerToClientMessage::XCastStateChange(state, x_cast)
                    }
                }

            }
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
            ServerToClientMessage::RoomSwitched(_) => {
                (7, "".to_owned())
            }
            ServerToClientMessage::XCastStateChange(state, _) => {
                (8, serde_json::to_string(&state).unwrap())
            }
            ServerToClientMessage::RoomLeave(_) => {
                (9, "".to_owned())
            }
        };
        format!("{}_%_{}", code, serialized)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonalizeUpdate {
    pub name: String,
    pub portrait_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SwitchRoomPayload {
    pub mode: GameMode
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
}
