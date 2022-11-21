use uuid::Uuid;

use crate::net::ServerToClientMessage;

#[derive(Debug, Clone)]
pub enum XCast {
    // state_id
    Broadcast(Uuid),
    // state_id, exclude_id
    MulticastExcl(Uuid, Uuid),
    // state_id, target_id
    Unicast(Uuid, Uuid),
}

pub fn check_message_casting(
    client_id: Uuid,
    message: &ServerToClientMessage,
    current_state_id: Uuid,
) -> bool {
    match message.clone() {
        ServerToClientMessage::ObsoleteStateBroadcast(state) => {
            if current_state_id == state.id {
                true
            } else {
                false
            }
        }
        ServerToClientMessage::ObsoleteStateChangeExclusive(state, exclude_client_id) => {
            if state.id != current_state_id {
                false
            } else {
                if client_id != exclude_client_id {
                    true
                } else {
                    false
                }
            }
        }
        ServerToClientMessage::TagConfirm(_, target_client_id) => {
            if client_id == target_client_id {
                true
            } else {
                false
            }
        }
        ServerToClientMessage::MulticastPartialShipUpdate(_, exclude_client_id, state_id) => {
            if state_id != current_state_id {
                false
            } else {
                if exclude_client_id.is_some() && client_id != exclude_client_id.unwrap() {
                    true
                } else {
                    false
                }
            }
        }
        ServerToClientMessage::DialogueStateChange(_, target_client_id, state_id) => {
            if state_id != current_state_id {
                false
            } else {
                if client_id == target_client_id {
                    true
                } else {
                    false
                }
            }
        }
        ServerToClientMessage::XCastGameEvent(_, x_cast) => {
            should_send_xcast(client_id, x_cast, current_state_id)
        }
        ServerToClientMessage::RoomSwitched(x_cast) => {
            should_send_xcast(client_id, x_cast, current_state_id)
        }
        ServerToClientMessage::XCastStateChange(_, x_cast) => {
            should_send_xcast(client_id, x_cast, current_state_id)
        }
        ServerToClientMessage::RoomLeave(target_player) => target_player == client_id,
        ServerToClientMessage::Pong(pong) => pong.target_player_id == client_id,
    }
}

fn should_send_xcast(client_id: Uuid, x_cast: XCast, current_state_id: Uuid) -> bool {
    match x_cast {
        XCast::Broadcast(target_state_id) => target_state_id == current_state_id,
        XCast::MulticastExcl(target_state_id, exclude) => {
            if target_state_id != current_state_id {
                false
            } else {
                if client_id != exclude {
                    true
                } else {
                    false
                }
            }
        }
        XCast::Unicast(target_state_id, target) => {
            if target_state_id != current_state_id {
                false
            } else {
                if client_id == target {
                    true
                } else {
                    false
                }
            }
        }
    }
}
