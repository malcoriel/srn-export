#[cfg(test)]
mod planet_movement_test {
    use crate::world::*;
    use crate::planet_movement::*;
    use crate::perf::{Sampler};

    const SEED_TIME: i64 = 9321 * 1000 * 1000;

    #[test]
    pub fn can_deal_with_nasty_seed() {
        let state = gen_state_by_seed(false, "ab12a8ea2d15cd5c".to_string());
        let mut state = validate_state(state);
        eprintln!("star id {}", state.star.clone().map_or(Default::default(), |s| s.id));
        let name_anchors = state.planets.iter().map(|p| (p.id, p.name.clone(), p.anchor_id)).collect::<Vec<_>>();
        eprintln!("name_anchors 1 {:?}", name_anchors);
        let (planets, _sampler) = update_planets(&state.planets, &state.star, SEED_TIME, Sampler::empty(), AABB::maxed());
        state.planets = planets;
        let name_anchors = state.planets.iter().map(|p| (p.id, p.name.clone(), p.anchor_id)).collect::<Vec<_>>();
        eprintln!("name_anchors 2 {:?}", name_anchors);
        let valid = extract_valid_planets(&state);
        assert_eq!(valid.len(), state.planets.len());
    }
}