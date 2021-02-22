use uuid::Uuid;

use crate::dialogue::Dialogue;
use crate::world::{GameEvent, GameState, Ship};
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
    StateChange(GameState),
    StateChangeExclusive(GameState, Uuid),
    TagConfirm(TagConfirm, Uuid),
    MulticastPartialShipUpdate(ShipsWrapper, Option<Uuid>, Uuid),
    DialogueStateChange(Wrapper<Option<Dialogue>>, Uuid, Uuid),
    XCastGameEvent(Wrapper<GameEvent>, XCast),
    RoomSwitched(XCast),
}

impl ServerToClientMessage {
    pub fn serialize(&self) -> String {
        let (code, serialized) = match self {
            ServerToClientMessage::StateChange(state) => {
                (1, serde_json::to_string(&state).unwrap())
            }
            ServerToClientMessage::StateChangeExclusive(state, _unused) => {
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
        };
        format!("{}_%_{}", code, serialized)
    }

    pub fn get_state_id(&self) -> Uuid {
        match self {
            ServerToClientMessage::StateChange(state) => { state.id }
            ServerToClientMessage::StateChangeExclusive(state, _) => { state.id }
            ServerToClientMessage::TagConfirm(_, state_id) => { state_id.clone() }
            ServerToClientMessage::MulticastPartialShipUpdate(_, _, state_id) => { state_id.clone() }
            ServerToClientMessage::DialogueStateChange(_, _, state_id) => { state_id.clone() }
            ServerToClientMessage::XCastGameEvent(_, xcast) => { xcast.get_state_id() }
            ServerToClientMessage::RoomSwitched(xcast) => { xcast.get_state_id() }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PersonalizeUpdate {
    pub name: String,
    pub portrait_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SwitchRoomPayload {
    pub tutorial: bool
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
