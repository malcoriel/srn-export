#[cfg(test)]
mod world_test {
    use crate::dialogue::{
        execute_dialog_option, gen_basic_planet_script, DialogueScript, DialogueStates,
        DialogueTable, DialogueUpdate,
    };
    use crate::world;
    use crate::world::GameState;
    use std::collections::HashMap;
    use std::str::FromStr;
    use uuid::Uuid;

    #[test]
    fn can_move_between_valid_states() {
        let player_id = Uuid::new_v4();
        let (dialogue_id, first_state_id, second_state_id, go_next_id, go_back_id, exit_id, script) =
            gen_basic_planet_script();

        let mut d_table: DialogueTable = HashMap::new();
        d_table.insert(dialogue_id, script);

        let mut d_states: DialogueStates = HashMap::new();
        d_states.insert(player_id, HashMap::new());
        d_states
            .get_mut(&player_id)
            .unwrap()
            .insert(dialogue_id, Box::new(Some(first_state_id)));

        let mut state = world::seed_state(false, false);

        execute_dialog_option(
            &player_id,
            &mut state,
            DialogueUpdate {
                dialogue_id,
                option_id: go_next_id,
            },
            &mut d_states,
            &d_table,
        );
        let new_d_state = *d_states
            .get(&player_id)
            .unwrap()
            .get(&dialogue_id)
            .unwrap()
            .clone();
        execute_dialog_option(
            &player_id,
            &mut state,
            DialogueUpdate {
                dialogue_id,
                option_id: exit_id,
            },
            &mut d_states,
            &d_table,
        );
        let new_d_state = *d_states
            .get(&player_id)
            .unwrap()
            .get(&dialogue_id)
            .unwrap()
            .clone();
        assert_eq!(new_d_state, None);
    }
}