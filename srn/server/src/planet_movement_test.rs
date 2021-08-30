#[cfg(test)]
mod planet_movement_test {
    use crate::perf::Sampler;
    use crate::planet_movement::*;
    use crate::system_gen::{extract_valid_planets, gen_state, validate_state};
    use crate::world::*;

    const SEED_TIME: i64 = 9321 * 1000 * 1000;

    #[test]
    pub fn can_deal_with_nasty_seed() {
        let state = gen_state("ab12a8ea2d15cd5c".to_string());
        let mut state = validate_state(state);
        let location = &mut state.locations[0];
        eprintln!(
            "star id {}",
            location.star.clone().map_or(Default::default(), |s| s.id)
        );
        let name_anchors = location
            .planets
            .iter()
            .map(|p| (p.id, p.name.clone(), p.anchor_id))
            .collect::<Vec<_>>();
        eprintln!("name_anchors 1 {:?}", name_anchors);
        let (planets, _sampler) = update_planets(
            &location.planets,
            &location.star,
            SEED_TIME,
            Sampler::empty(),
            AABB::maxed(),
        );
        location.planets = planets;
        let name_anchors = location
            .planets
            .iter()
            .map(|p| (p.id, p.name.clone(), p.anchor_id))
            .collect::<Vec<_>>();
        eprintln!("name_anchors 2 {:?}", name_anchors);
        let valid = extract_valid_planets(&state, 0);
        let location = &mut state.locations[0];
        assert_eq!(valid.len(), location.planets.len());
    }
}
