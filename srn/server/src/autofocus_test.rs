#[cfg(test)]
mod autofocus_test {
    use crate::indexing::ObjectSpecifier;
    use crate::inventory::{consume_items_of_type, InventoryItem, InventoryItemType};
    use crate::perf::Sampler;
    use crate::vec2::Vec2f64;
    use crate::world::{
        spawn_ship, update_location, GameMode, GameState, Location, Planet, Player, UpdateOptions,
    };
    use crate::{autofocus, new_id};

    #[test]
    pub fn can_focus_closest_planet() {
        let player_id = new_id();
        let mut state = GameState::new();
        state
            .players
            .push(Player::new(player_id, &GameMode::CargoRush));
        let loc = Location::new_empty();
        state.locations.push(loc);
        spawn_ship(
            &mut state,
            player_id,
            Some(Vec2f64 { x: 0.0, y: 0.0 }),
            false,
        );
        let mut closest = Planet::new();
        closest.id = new_id();
        closest.x = 5.0;
        closest.y = 0.0;
        let closest_id = closest.id.clone();
        state.locations[0].planets.push(closest);
        let mut other = Planet::new();
        other.id = new_id();
        other.x = 5.0;
        other.y = 0.5;
        state.locations[0].planets.push(other);
        autofocus::update_autofocus_full(&mut state);
        let ship = &state.locations[0].ships[0];
        assert_eq!(
            ship.auto_focus,
            Some(ObjectSpecifier::Planet { id: closest_id })
        );
    }
}
