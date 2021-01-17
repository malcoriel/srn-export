use uuid::Uuid;

use crate::ServerToClientMessage;

#[derive(Debug, Clone)]
pub enum XCast {
    Broadcast,
    MulticastExcl(Uuid),
    Unicast(Uuid),
}

pub fn check_message_casting(client_id: Uuid, message: &ServerToClientMessage) -> bool {
    match message.clone() {
        ServerToClientMessage::StateChange(_) => true,
        ServerToClientMessage::StateChangeExclusive(_, exclude_client_id) => {
            if client_id != exclude_client_id {
                true
            } else {
                false
            }
        }
        ServerToClientMessage::TagConfirm(_, target_client_id) => {
            if client_id == target_client_id {
                true
            } else {
                false
            }
        }
        ServerToClientMessage::MulticastPartialShipUpdate(_, exclude_client_id) => {
            if exclude_client_id.is_some() && client_id != exclude_client_id.unwrap() {
                true
            } else {
                false
            }
        }
        ServerToClientMessage::DialogueStateChange(_, target_client_id) => {
            if client_id == target_client_id {
                true
            } else {
                false
            }
        }
        ServerToClientMessage::XCastGameEvent(_, x_cast) => should_send_xcast(client_id, x_cast),
    }
}

fn should_send_xcast(client_id: Uuid, x_cast: XCast) -> bool {
    match x_cast {
        XCast::Broadcast => true,
        XCast::MulticastExcl(exclude) => {
            if client_id != exclude {
                true
            } else {
                false
            }
        }
        XCast::Unicast(target) => {
            if client_id == target {
                true
            } else {
                false
            }
        }
    }
}
