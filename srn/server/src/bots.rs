use crate::new_id;
use crate::world::{find_my_ship, GameState, Ship};
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
        let my_ship = find_my_ship(&state, &self.id);
        if my_ship.is_none() {
            eprintln!("{} no ship", self.id);
            return (self, None);
        }

        let mut ship = my_ship.unwrap().clone();
        ship.x = 10.0 * ((state.ticks as f64).sin());
        (self, Some(ship))
    }
}
