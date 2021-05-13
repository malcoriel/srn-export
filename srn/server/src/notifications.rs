use crate::dialogue_dto::Substitution;
use crate::new_id;
use crate::world::GameMode;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum Notification {
    Unknown,
    Help {
        header: String,
        text: NotificationText,
        id: Uuid,
    },
    Task {
        header: String,
        text: NotificationText,
        id: Uuid,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")]
pub enum NotificationAction {
    Unknown,
    Dismiss { id: Uuid },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct NotificationText {
    pub text: String,
    pub substitutions: Vec<Substitution>,
}

pub fn get_new_player_notifications(_mode: &GameMode) -> Vec<Notification> {
    return vec![
        Notification::Help {
            header: "How to play".to_string(),
            text: NotificationText {
                text: "Welcome to the Star Rangers Network, Cargo Rush mode!\nThe main goal of this mode is to outperform your opponents in earning money. You can see it near the bottom of the screen. You have to become the owner of the most money by the end of the round. And the clock is already ticking - see that timer on top of the screen?".to_string(),
                substitutions: vec![],
            },
            id: new_id(),
        },
        Notification::Help {
            header: "Basic controls".to_string(),
            text: NotificationText {
                text: "If you haven't played the tutorial yet, it's best to do it before playing this mode. However, in case you don't want boring explanations, here is the quick summary:\n1. Use WASD or left mouse button to move.\n2. To interact with something, click on it.\n3. To jump to another system, press M and click on a star.\n4. Press Esc to show the main game menu.\n5. If you have lost your ship, press C to center camera on it".to_string(),
                substitutions: vec![],
            },
            id: new_id(),
        },
        Notification::Help {
            header: "What to do".to_string(),
            text: NotificationText {
                text: "You are probably wondering how to actually win. One way would be to work on deliveries - check your other notification with the delivery quest. Or you can search the systems for valuables like floating containers and minerals, and sell them on the planets.".to_string(),
                substitutions: vec![],
            },
            id: new_id(),
        }
    ];
}

// #[wasm_bindgen]
// pub fn is_notification_dismissable(_not: Notification) -> bool {
//     return false;
// }
