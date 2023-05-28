use core::mem;
use std::collections::HashSet;

use serde_derive::{Deserialize, Serialize};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::abilities::{Ability, SHOOT_ABILITY_DURATION, SHOOT_COOLDOWN_TICKS};
use crate::combat::ShootTarget;
use crate::indexing::{
    find_my_player, find_my_player_mut, find_my_ship_index, find_my_ship_mut,
    find_player_by_ship_id, find_player_idx_by_ship_id, GameStateIndexes,
};
use crate::planet_movement::IBodyV2;
use crate::vec2::Vec2f64;
use crate::world::{spawn_ship, GameState, ShipIdx, ShipTemplate, PLAYER_RESPAWN_TIME_MC};
use crate::{abilities, combat, indexing, locations, prng_id, spatial_movement, world};

use rand::prelude::*;
use rand_pcg::Pcg64Mcg;
use serde_json::Value;
use std::f64::consts::PI;

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongActionStart {
    Unknown,
    TransSystemJump {
        to: Uuid,
    },
    Respawn,
    Shoot {
        target: ShootTarget,
        turret_id: String,
    },
    Launch {
        target: ShootTarget,
        turret_id: String,
    },
    // the process of docking itself after the ship is close enough via navigation
    DockInternal {
        to_planet: Uuid,
    },
    // the process of undocking
    UndockInternal {
        from_planet: Uuid,
    },
    UseAbility {
        ability_idx: usize,
        params: serde_json::Value,
    },
}

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongActionPlayer {
    Unknown {
        id: Uuid,
    },
    Respawn {
        id: Uuid,
        micro_left: i32,
        percentage: u32,
    },
}

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum LongAction {
    Unknown {
        id: Uuid,
    },
    TransSystemJump {
        id: Uuid,
        to: Uuid,
        micro_left: i32,
        percentage: u32,
    },
    Shoot {
        id: Uuid,
        target: ShootTarget,
        micro_left: i32,
        percentage: u32,
        turret_id: String,
    },
    Launch {
        id: Uuid,
        target: ShootTarget,
        micro_left: i32,
        percentage: u32,
        turret_id: String,
        projectile_template_id: i32,
    },
    Dock {
        id: Uuid,
        to_planet: Uuid,
        start_pos: Vec2f64,
        micro_left: i32,
        percentage: u32,
    },
    Undock {
        id: Uuid,
        from_planet: Uuid,
        start_pos: Vec2f64,
        end_pos: Vec2f64,
        micro_left: i32,
        percentage: u32,
    },
}

pub fn erase_details(la: LongAction) -> LongAction {
    return match la {
        LongAction::Unknown { .. } => LongAction::Unknown {
            id: Default::default(),
        },
        LongAction::TransSystemJump { .. } => LongAction::TransSystemJump {
            id: Default::default(),
            to: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Shoot { .. } => LongAction::Shoot {
            id: Default::default(),
            target: Default::default(),
            micro_left: 0,
            percentage: 0,
            turret_id: Default::default(),
        },
        LongAction::Dock { .. } => LongAction::Dock {
            id: Default::default(),
            to_planet: Default::default(),
            start_pos: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Undock { .. } => LongAction::Undock {
            id: Default::default(),
            from_planet: Default::default(),
            start_pos: Default::default(),
            end_pos: Default::default(),
            micro_left: 0,
            percentage: 0,
        },
        LongAction::Launch { .. } => LongAction::Launch {
            id: Default::default(),
            target: Default::default(),
            micro_left: 0,
            percentage: 0,
            turret_id: Default::default(),
            projectile_template_id: 0,
        },
    };
}

// This will compare the type only, all details like id are ignored for the sake of equality
pub fn cancel_all_long_actions_of_type(la: &mut Vec<LongAction>, template: LongAction) {
    // rust does not understand usage in matches! macro
    let _t = erase_details(template);
    let mut new_la = la
        .clone()
        .into_iter()
        .filter_map(|a| {
            return if matches!(erase_details(a.clone()), _t) {
                None
            } else {
                Some(a)
            };
        })
        .collect();
    mem::swap(la, &mut new_la);
}

pub fn try_start_long_action_ship_only(
    state: &mut GameState,
    ship_idx: &ShipIdx,
    action: LongActionStart,
    prng: &mut Pcg64Mcg,
) -> bool {
    match action {
        LongActionStart::Shoot {
            target, turret_id, ..
        } => {
            try_start_shoot(state, target, Some(ship_idx.clone()), turret_id, prng);
            true
        }
        LongActionStart::DockInternal { to_planet, .. } => {
            try_start_dock(state, to_planet, ship_idx.clone(), prng)
        }
        LongActionStart::UndockInternal { from_planet, .. } => {
            try_start_undock(state, prng, from_planet, ship_idx.clone())
        }
        _ => {
            warn!(format!(
                "Impossible ship action start for action {:?}",
                action
            ));
            false
        }
    }
}

pub fn try_start_long_action_player_owned(
    state: &mut GameState,
    player_id: Uuid,
    action: LongActionStart,
    prng: &mut Pcg64Mcg,
) -> bool {
    match action {
        LongActionStart::Unknown => {
            return false;
        }
        LongActionStart::TransSystemJump { to } => {
            if !locations::can_be_moved_player(state, player_id, to) {
                return false;
            }
            let ship = find_my_ship_mut(state, player_id);
            if ship.is_none() {
                return false;
            }
            let ship = ship.unwrap();
            ship.long_actions.push(LongAction::TransSystemJump {
                id: prng_id(prng),
                to,
                micro_left: TRANS_SYSTEM_JUMP_TIME,
                percentage: 0,
            });
            revalidate(&mut ship.long_actions);
        }
        LongActionStart::Respawn => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_some() {
                return false;
            }
            let player = find_my_player_mut(state, player_id);
            if player.is_none() {
                return false;
            }
            let player = player.unwrap();
            player.long_actions.push(LongActionPlayer::Respawn {
                id: prng_id(prng),
                micro_left: PLAYER_RESPAWN_TIME_MC,
                percentage: 0,
            });
            revalidate_player(&mut player.long_actions);
        }
        LongActionStart::Shoot { target, turret_id } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            return try_start_shoot(state, target, ship_idx, turret_id, prng);
        }
        LongActionStart::Launch { target, turret_id } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            return try_start_launch(state, target, ship_idx, turret_id, prng);
        }
        LongActionStart::DockInternal { to_planet, .. } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            return try_start_dock(state, to_planet, ship_idx, prng);
        }
        LongActionStart::UndockInternal { from_planet } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            return try_start_undock(state, prng, from_planet, ship_idx);
        }
        LongActionStart::UseAbility {
            ability_idx,
            params,
        } => {
            let ship_idx = find_my_ship_index(state, player_id);
            if ship_idx.is_none() {
                return false;
            }
            let ship_idx = ship_idx.unwrap();
            return abilities::try_invoke(state, ship_idx, ability_idx, params);
        }
    }
    return true;
}

fn try_start_undock(
    state: &mut GameState,
    prng: &mut Pcg64Mcg,
    from_planet: Uuid,
    ship_idx: ShipIdx,
) -> bool {
    let planet = &state.locations[ship_idx.location_idx]
        .planets
        .iter()
        .find(|p| p.id == from_planet);
    if planet.is_none() {
        return false;
    }
    let planet = planet.unwrap();
    let random_angle = prng.gen_range(0.0, PI * 2.0);
    let dist = (planet.spatial.radius * 1.2).max(MIN_SHIP_DOCKING_RADIUS);
    let planet_pos = Vec2f64 {
        x: planet.spatial.position.x,
        y: planet.spatial.position.y,
    };
    let vec = Vec2f64 { x: 1.0, y: 0.0 }
        .rotate(random_angle)
        .scalar_mul(dist)
        .add(&planet_pos);
    let act = LongAction::Undock {
        id: prng_id(prng),
        from_planet,
        start_pos: planet_pos,
        end_pos: Vec2f64 { x: vec.x, y: vec.y },
        micro_left: SHIP_DOCK_TIME_TICKS,
        percentage: 0,
    };
    let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    ship.long_actions.push(act);
    return true;
}

fn try_start_dock(
    state: &mut GameState,
    to_planet: Uuid,
    ship_idx: ShipIdx,
    prng: &mut Pcg64Mcg,
) -> bool {
    let ship = &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    let planet = &state.locations[ship_idx.location_idx]
        .planets
        .iter()
        .find(|p| p.id == to_planet);
    if planet.is_none() {
        return false;
    }
    let planet = planet.unwrap();
    // currently, docking can only be initiated in the planet radius
    let ship_pos = ship.spatial.position.clone();
    let planet_pos = planet.spatial.position.clone();
    if planet_pos.euclidean_distance(&ship_pos)
        > (planet.spatial.radius * SHIP_DOCKING_RADIUS_COEFF).max(MIN_SHIP_DOCKING_RADIUS)
    {
        return false;
    }
    let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    let act = LongAction::Dock {
        id: prng_id(prng),
        to_planet,
        start_pos: ship_pos,
        micro_left: SHIP_DOCK_TIME_TICKS,
        percentage: 0,
    };
    ship.long_actions.push(act);
    ship.trajectory = vec![];
    ship.dock_target = None;
    ship.navigate_target = None;
    return true;
}

fn try_start_shoot(
    state: &mut GameState,
    target: ShootTarget,
    ship_idx: Option<ShipIdx>,
    shooting_turret_id: String,
    prng: &mut Pcg64Mcg,
) -> bool {
    let ship_idx = ship_idx.unwrap();
    if !combat::validate_shoot(
        target.clone(),
        &state.locations[ship_idx.location_idx],
        &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx],
        shooting_turret_id.clone(),
    ) {
        return false;
    }

    let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    ship.long_actions.push(LongAction::Shoot {
        id: prng_id(prng),
        target,
        micro_left: SHOOT_COOLDOWN_TICKS,
        percentage: 0,
        turret_id: shooting_turret_id.clone(),
    });
    revalidate(&mut ship.long_actions);
    for ability in ship.abilities.iter_mut() {
        match ability {
            Ability::Unknown => {}
            Ability::Shoot { turret_id, .. } => {
                if *turret_id == shooting_turret_id {
                    ability.set_max_cooldown();
                }
            }
            Ability::BlowUpOnLand => {}
            Ability::ShootAll => {}
            Ability::ToggleMovement { .. } => {}
            Ability::Launch { turret_id, .. } => {
                if *turret_id == shooting_turret_id {
                    ability.set_max_cooldown();
                }
            }
        }
    }
    return true;
}

fn try_start_launch(
    state: &mut GameState,
    target: ShootTarget,
    ship_idx: Option<ShipIdx>,
    shooting_turret_id: String,
    prng: &mut Pcg64Mcg,
) -> bool {
    let ship_idx = ship_idx.unwrap();
    if !combat::validate_launch(
        target.clone(),
        &state.locations[ship_idx.location_idx],
        &state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx],
        shooting_turret_id.clone(),
    ) {
        return false;
    }

    let ship = &mut state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx];
    let shoot_ability = combat::find_turret_ability(ship, shooting_turret_id.clone())
        .map(|a| a.clone())
        .unwrap(); // checked by validate
    ship.long_actions.push(LongAction::Launch {
        id: prng_id(prng),
        target,
        micro_left: SHOOT_COOLDOWN_TICKS,
        percentage: 0,
        turret_id: shooting_turret_id.clone(),
        projectile_template_id: match shoot_ability {
            Ability::Launch {
                projectile_template_id,
                ..
            } => projectile_template_id,
            _ => panic!("No projectile template id for launch ability start"),
        },
    });
    revalidate(&mut ship.long_actions);
    for ability in ship.abilities.iter_mut() {
        match ability {
            Ability::Unknown => {}
            Ability::Shoot { turret_id, .. } => {
                if *turret_id == shooting_turret_id {
                    ability.set_max_cooldown();
                }
            }
            Ability::BlowUpOnLand => {}
            Ability::ShootAll => {}
            Ability::ToggleMovement { .. } => {}
            Ability::Launch { turret_id, .. } => {
                if *turret_id == shooting_turret_id {
                    ability.set_max_cooldown();
                }
            }
        }
    }
    return true;
}

// protect against repetition of actions,
// for those that must be unique - keep the first
// for multiple - unique by some criteria, e.g. turret_id
fn revalidate(long_actions: &mut Vec<LongAction>) {
    let mut has_jump = false;
    let mut has_dock = false;
    let mut has_undock = false;
    let mut active_turret_ids: HashSet<String> = HashSet::new();
    let mut new_actions = long_actions
        .clone()
        .into_iter()
        .filter(|a| match &a {
            LongAction::Unknown { .. } => false,
            LongAction::TransSystemJump { .. } => {
                if has_jump {
                    return false;
                }
                has_jump = true;
                return true;
            }
            LongAction::Shoot { turret_id, .. } => {
                if active_turret_ids.contains(turret_id) {
                    return false;
                }
                active_turret_ids.insert(turret_id.clone());
                return true;
            }
            LongAction::Dock { .. } => {
                if has_dock || has_undock {
                    return false;
                }
                has_dock = true;
                return true;
            }
            LongAction::Undock { .. } => {
                if has_dock || has_undock {
                    return false;
                }
                has_undock = true;
                return true;
            }
            LongAction::Launch { turret_id, .. } => {
                if active_turret_ids.contains(turret_id) {
                    return false;
                }
                active_turret_ids.insert(turret_id.clone());
                return true;
            }
        })
        .collect();
    mem::swap(long_actions, &mut new_actions);
}

fn revalidate_player(long_actions: &mut Vec<LongActionPlayer>) {
    let mut has_respawn = false;
    let mut new_actions = long_actions
        .clone()
        .into_iter()
        .filter_map(|a| match a {
            LongActionPlayer::Unknown { .. } => Some(a),
            LongActionPlayer::Respawn { .. } => {
                if has_respawn {
                    return None;
                }
                has_respawn = true;
                Some(a)
            }
        })
        .collect();
    mem::swap(long_actions, &mut new_actions);
}

const TRANS_SYSTEM_JUMP_TIME: i32 = 5 * 1000 * 1000;
const SHIP_DOCK_TIME_TICKS: i32 = 1 * 1000 * 1000;
const SHIP_UNDOCK_TIME_TICKS: i32 = 1 * 1000 * 1000;
pub const SHIP_DOCKING_RADIUS_COEFF: f64 = 2.0;
pub const MIN_SHIP_DOCKING_RADIUS: f64 = 5.0;

pub fn finish_long_act(
    state: &mut GameState,
    player_id: Option<Uuid>,
    act: LongAction,
    client: bool,
    ship_idx: ShipIdx,
    prng: &mut Pcg64Mcg,
    indexes: &GameStateIndexes,
) {
    match act {
        LongAction::Unknown { .. } => {
            // nothing to do
        }
        LongAction::TransSystemJump { to, .. } => {
            if !client && player_id.is_some() {
                locations::try_move_player_ship(state, player_id.unwrap(), to);
            }
        }
        LongAction::Shoot {
            target, turret_id, ..
        } => {
            if player_id.is_some() {
                combat::resolve_shoot(state, player_id.unwrap(), target, turret_id, client);
            }
        }
        LongAction::Dock { to_planet, .. } => {
            let planet = indexing::find_planet(state, &to_planet).map(|p| p.clone());
            let ship_id = state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx].id;
            let player_idx = find_player_idx_by_ship_id(state, ship_id);
            if let Some(planet) = planet {
                let body = Box::new(planet) as Box<dyn IBodyV2>;
                spatial_movement::dock_ship(state, ship_idx, player_idx, body);
            }
        }
        LongAction::Undock { .. } => {
            let ship_id = state.locations[ship_idx.location_idx].ships[ship_idx.ship_idx].id;
            let player = find_player_idx_by_ship_id(state, ship_id).map(|p| p.clone());
            spatial_movement::undock_ship(state, ship_idx, client, player, prng);
        }
        LongAction::Launch {
            target, turret_id, ..
        } => {
            if player_id.is_some() {
                combat::resolve_launch(
                    state,
                    player_id.unwrap(),
                    target,
                    turret_id,
                    client,
                    indexes,
                    prng,
                );
            }
        }
    }
}

pub fn finish_long_act_player(
    state: &mut GameState,
    player_id: Uuid,
    act: LongActionPlayer,
    client: bool,
    prng: &mut Pcg64Mcg,
) {
    match act {
        LongActionPlayer::Unknown { .. } => {
            // nothing to do
        }
        LongActionPlayer::Respawn { .. } => {
            if !client {
                spawn_ship(state, Some(player_id), ShipTemplate::player(None), prng);
            }
        }
    }
}

// (update_action, keep_ticking)
pub fn tick_long_act(act: LongAction, micro_passed: i64) -> (LongAction, bool) {
    return match act {
        LongAction::Unknown { id } => (LongAction::Unknown { id }, false),
        LongAction::TransSystemJump {
            to, id, micro_left, ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::TransSystemJump {
                    id,
                    to,
                    micro_left: left,
                    percentage: calc_percentage(left, TRANS_SYSTEM_JUMP_TIME),
                },
                left > 0,
            )
        }
        LongAction::Shoot {
            micro_left,
            id,
            target,
            turret_id,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Shoot {
                    id,
                    micro_left: left,
                    target,
                    percentage: calc_percentage(left, SHOOT_ABILITY_DURATION),
                    turret_id,
                },
                left > 0,
            )
        }
        LongAction::Launch {
            micro_left,
            id,
            target,
            turret_id,
            projectile_template_id,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Launch {
                    id,
                    micro_left: left,
                    target,
                    percentage: calc_percentage(left, SHOOT_ABILITY_DURATION),
                    turret_id,
                    projectile_template_id,
                },
                left > 0,
            )
        }
        LongAction::Dock {
            micro_left,
            id,
            to_planet,
            start_pos,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            let i = calc_percentage(left, SHIP_DOCK_TIME_TICKS);
            (
                LongAction::Dock {
                    id,
                    micro_left: left,
                    to_planet,
                    start_pos,
                    percentage: i,
                },
                left > 0,
            )
        }
        LongAction::Undock {
            micro_left,
            id,
            from_planet,
            start_pos,
            end_pos,
            ..
        } => {
            let left = micro_left - micro_passed as i32;
            (
                LongAction::Undock {
                    id,
                    micro_left: left,
                    from_planet,
                    start_pos,
                    end_pos,
                    percentage: calc_percentage(left, SHIP_UNDOCK_TIME_TICKS),
                },
                left > 0,
            )
        }
    };
}

// (update_action, keep_ticking)
pub fn tick_long_act_player(act: LongActionPlayer, micro_passed: i64) -> (LongActionPlayer, bool) {
    return match act {
        LongActionPlayer::Unknown { id } => (LongActionPlayer::Unknown { id }, false),
        LongActionPlayer::Respawn { micro_left, id, .. } => {
            let left = micro_left - micro_passed as i32;
            (
                LongActionPlayer::Respawn {
                    id,
                    micro_left: left,
                    percentage: calc_percentage(left, PLAYER_RESPAWN_TIME_MC),
                },
                left > 0,
            )
        }
    };
}

fn calc_percentage(left: i32, max: i32) -> u32 {
    (((max as f32 - left as f32) / max as f32).max(0.0) * 100.0) as u32
}
