#[cfg(test)]
mod substitution_test {
    use crate::substitutions::substitute_text;
    use crate::world::Planet;
    use std::collections::HashMap;
    use uuid::Uuid;

    #[test]
    pub fn can_inject_ids() {
        let init = "The s_current_planet is on fire!".to_string();
        let mut players_to_current_planets = HashMap::new();
        let planet = Planet {
            id: Default::default(),
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
        let sub_id = subs_res[0].id;
        assert_eq!(subs_res[0].text, "FOO");
        assert_eq!(text_res, format!("The s_{} is on fire!", sub_id))
    }
}
