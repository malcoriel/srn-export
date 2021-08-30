#[cfg(test)]
mod world_test {
    use std::collections::HashMap;
    use std::str::FromStr;

    use uuid::Uuid;

    use crate::dialogue::{
        execute_dialog_option, read_from_resource, DialogueOptionSideEffect, DialogueScript,
        DialogueStates, DialogueTable, DialogueUpdate,
    };
    use crate::world::GameState;
    use crate::{dialogue, new_id, system_gen, world};

    // currently broken
    fn can_move_between_valid_states() {
        let player_id = Uuid::new_v4();
        // let (dialogue_id, first_state_id, _second_state_id, go_next_id, _go_back_id, exit_id, script) =
        let script = read_from_resource("basic_planet");
        let dialogue_id = script.id;
        let first_state_id = script.initial_state;
        let initial_options = script.options.get(&first_state_id).unwrap();
        let go_next_id = initial_options
            .iter()
            .find(|(_oid, name, _)| name == "Go to the marketplace to trade.")
            .unwrap()
            .0;
        let exit_id = initial_options
            .iter()
            .find(|(_oid, name, _)| name == "Undock and fly away")
            .unwrap()
            .0;

        let mut d_table: DialogueTable = DialogueTable::new();
        d_table.scripts.insert(dialogue_id, script);

        let mut d_states: DialogueStates = HashMap::new();
        d_states.insert(player_id, (None, HashMap::new()));
        d_states
            .get_mut(&player_id)
            .unwrap()
            .1
            .insert(dialogue_id, Box::new(Some(first_state_id)));

        let mut state = system_gen::seed_state_test(false, false);

        execute_dialog_option(
            player_id,
            &mut state,
            DialogueUpdate {
                dialogue_id,
                option_id: go_next_id,
            },
            &mut d_states,
            &d_table,
        );
        execute_dialog_option(
            player_id,
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
            .1
            .get(&dialogue_id)
            .unwrap()
            .clone();
        assert_eq!(new_d_state, None);
    }
}
