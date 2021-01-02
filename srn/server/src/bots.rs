use crate::new_id;
use crate::world::{find_my_player, find_my_ship, GameState, QuestState, Ship};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Bot {
    pub id: Uuid,
}

impl Bot {
    pub fn new() -> Self {
        Bot { id: new_id() }
    }
    pub fn act(self, state: GameState) -> (Self, Option<Ship>) {
        let player = find_my_player(&state, &self.id);
        if player.is_none() {
            eprintln!("{} no player", self.id);
            return (self, None);
        }
        let ship = find_my_ship(&state, &self.id);
        if ship.is_none() {
            eprintln!("{} no ship", self.id);
            return (self, None);
        }
        let ship_read = ship.unwrap();
        let mut ship = ship_read.clone();
        let player = player.unwrap();

        let target = if let Some(quest) = &player.quest {
            if quest.state == QuestState::Started {
                Some(quest.from_id)
            } else if quest.state == QuestState::Picked {
                Some(quest.to_id)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(target) = target {
            ship.dock_target = Some(target.clone());
            if ship_read.docked_at.is_some() {
                ship.docked_at = None;
            }
        }

        (self, Some(ship))
    }
}
