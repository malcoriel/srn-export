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
        let (planets, _sampler) = update_planets(&state.planets, &state.star, SEED_TIME, Sampler::empty(), AABB::maxed());
        state.planets = planets;
        let valid = extract_valid_planets(&state);
        assert_eq!(valid.len(), state.planets.len());
    }
}
