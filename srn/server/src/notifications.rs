use std::collections::HashMap;


use rand_pcg::Pcg64Mcg;
use rand::prelude::*;
use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypescriptDefinition, TypeScriptify};
use uuid::Uuid;
use uuid::*;
use wasm_bindgen::prelude::*;

use crate::indexing::{find_my_player_mut, index_planets_by_id};
use crate::inventory::{count_items_of_types, MINERAL_TYPES, value_items_of_types};
use crate::random_stuff::gen_random_character_name;
use crate::world::{GameMode, GameState, Planet, Player, Ship};
use crate::{prng_id, substitutions};
use crate::dialogue::{Substitution, SubstitutionType};

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

impl Notification {
    pub fn get_id(&self) -> Uuid {
        return match self {
            Notification::Unknown => Uuid::default(),
            Notification::Help { id, .. } => *id,
            Notification::Task { id, .. } => *id,
        };
    }
    pub fn get_text_mut(&mut self) -> Option<&mut NotificationText> {
        return match self {
            Notification::Unknown => None,
            Notification::Help { text, .. } => Some(text),
            Notification::Task { text, .. } => Some(text),
        };
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
#[serde(tag = "tag")] // must be named R because otherwise TS will pick up NotificationAction from DOM
pub enum NotificationActionR {
    Unknown,
    Dismiss { id: Uuid },
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct NotificationText {
    pub text: String,
    pub substituted: bool,
    pub substitutions: Vec<Substitution>,
}

pub fn get_new_player_notifications(_mode: &GameMode, prng: &mut Pcg64Mcg) -> Vec<Notification> {
    log!("notifications built");
    return vec![
        Notification::Help {
            header: "How to play".to_string(),
            text: NotificationText {
                text: "Welcome to the Star Rangers Network, Cargo Rush mode!\nThe main goal of this mode is to outperform your opponents in earning money. You can see it near the bottom of the screen. You have to become the owner of the most money by the end of the round. And the clock is already ticking - see that timer on top of the screen?".to_string(),
                substituted: true,
                substitutions: vec![],
            },
            id: prng_id(prng),
        },
        Notification::Help {
            header: "Basic controls".to_string(),
            text: NotificationText {
                text: "If you haven't played the tutorial yet, it's best to do it before playing this mode. However, in case you don't want boring explanations, here is the quick summary:\n1. Use WASD or left mouse button to move.\n2. To interact with something, click on it.\n3. To jump to another system, press M and click on a star.\n4. Press Esc to show the main game menu.\n5. If you have lost your ship, press C to center camera on it".to_string(),
                substituted: true,
                substitutions: vec![],
            },
            id: prng_id(prng),
        },
        Notification::Help {
            header: "What to do".to_string(),
            text: NotificationText {
                text: "You are probably wondering how to actually win. One way would be to work on deliveries - check your other notification with the delivery quest. Or you can search the systems for valuables like floating containers and minerals, and sell them on the planets.".to_string(),
                substituted: true,
                substitutions: vec![],
            },
            id: prng_id(prng),
        }
    ];
}

pub fn apply_action(state: &mut GameState, player_id: Uuid, action: NotificationActionR) {
    match action {
        NotificationActionR::Unknown => {}
        NotificationActionR::Dismiss { id } => {
            let player = find_my_player_mut(state, player_id);
            if let Some(player) = player {
                log!(format!("cleaning {} of {:?}", id, player.notifications));
                player.notifications.retain(|n| n.get_id() != id);
                log!(format!("result {:?}", player.notifications));
            }
        }
    }
}

// #[wasm_bindgen]
// pub fn is_notification_dismissable(_not: Notification) -> bool {
//     return false;
// }

pub fn update_quest_notifications(player: &mut Player, prng: &mut Pcg64Mcg) {
    player.notifications.retain(|n| match n {
        Notification::Task { .. } => false,
        _ => true,
    });
    if let Some(quest) = player.quest.clone() {
        player.notifications.push(quest.as_notification(prng));
    }
}
