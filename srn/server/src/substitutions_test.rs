#[cfg(test)]
mod substitution_test {
    use crate::substitutions::substitute_text;
    use crate::world::{CargoDeliveryQuestState, GameMode, Planet, Player, Quest};
    use std::collections::HashMap;
    use uuid::Uuid;

    #[test]
    pub fn can_inject_ids() {
        let init = "The s_current_planet is on fire!".to_string();
        let mut players_to_current_planets = HashMap::new();
        let planet_id = Uuid::new_v4();
        let planet = Planet {
            id: planet_id,
            name: "FOO".to_string(),
            x: 0.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.0,
            anchor_id: Default::default(),
            anchor_tier: 0,
            color: "".to_string(),
        };
        players_to_current_planets.insert(Uuid::default(), &planet);
        let (subs_res, text_res) = substitute_text(
            &init,
            Uuid::default(),
            &players_to_current_planets,
            &HashMap::new(),
            &HashMap::new(),
            &HashMap::new(),
        );
        assert_eq!(subs_res[0].text, "FOO");
        assert_eq!(text_res, format!("The s_{} is on fire!", planet_id))
    }

    #[test]
    pub fn can_do_double_substitutions() {
        // this is a special case because the substitutions happen sequentially, and the underlying
        // inject_sub_text should not accidentally mix ids
        let init = "Deliver the goods from s_cargo_source_planet to s_cargo_destination_planet"
            .to_string();
        let mut planets_by_id = HashMap::new();
        let source_planet_id = Uuid::new_v4();
        let source_planet = Planet {
            id: source_planet_id,
            name: "SOURCE".to_string(),
            x: 0.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.0,
            anchor_id: Default::default(),
            anchor_tier: 0,
            color: "".to_string(),
        };
        planets_by_id.insert(source_planet_id, &source_planet);
        let dest_planet_id = Uuid::new_v4();
        let dest_planet = Planet {
            id: dest_planet_id,
            name: "DEST".to_string(),
            x: 0.0,
            y: 0.0,
            rotation: 0.0,
            radius: 0.0,
            orbit_speed: 0.0,
            anchor_id: Default::default(),
            anchor_tier: 0,
            color: "".to_string(),
        };
        planets_by_id.insert(dest_planet_id, &dest_planet);
        let mut players_by_id = HashMap::new();
        let mut player = Player::new(Uuid::default(), &GameMode::CargoRush);
        player.quest = Some(Quest {
            id: Default::default(),
            from_id: source_planet_id,
            to_id: dest_planet_id,
            state: CargoDeliveryQuestState::Unknown,
            reward: 0,
        });
        players_by_id.insert(Uuid::default(), &player);
        let (subs_res, text_res) = substitute_text(
            &init,
            Uuid::default(),
            &HashMap::new(),
            &players_by_id,
            &planets_by_id,
            &HashMap::new(),
        );

        assert_eq!(subs_res[0].text, "SOURCE");
        assert_eq!(subs_res[1].text, "DEST");
        assert_eq!(
            text_res,
            format!(
                "Deliver the goods from s_{} to s_{}",
                source_planet_id, dest_planet_id
            )
        );
    }
}
