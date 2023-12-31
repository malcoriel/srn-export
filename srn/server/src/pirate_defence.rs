use itertools::Itertools;
use std::f64::consts::PI;

use rand::prelude::*;
use rand::Rng;
use rand_pcg::Pcg64Mcg;
use uuid::Uuid;

use crate::abilities::{Ability, SHOOT_DEFAULT_DISTANCE};
use crate::api_struct::AiTrait;
use crate::api_struct::{new_bot, Bot, Room};
use crate::bots::{add_bot, BotAct};
use crate::dialogue::DialogueStatesForPlayer;
use crate::fof::{resolve_player_id, FofActor, FriendOrFoe};
use crate::indexing::{
    find_player_ship_index, index_players_by_ship_id, index_state, GameStateIndexes,
    ObjectIndexSpecifier, ObjectSpecifier,
};
use crate::long_actions::LongActionStart;
use crate::properties::{find_property, ObjectProperty, ObjectPropertyKey};
use crate::vec2::Vec2f64;
use crate::world::TimeMarks::BotAction;
use crate::world::{GameOver, GameState, PlanetV2, Ship, ShipTemplate, SpatialIndexes, TimeMarks};
use crate::world_actions::Action;
use crate::world_events::{fire_saved_event, GameEvent};
use crate::{fire_event, fof, indexing, prng_id, world, DialogueTable};

pub fn on_pirate_spawn(state: &mut GameState, at: &Vec2f64, prng: &mut Pcg64Mcg) {
    if !state.paused {
        world::spawn_ship(state, None, ShipTemplate::pirate(Some(at.clone())), prng);
    }
}

const SHIP_PLANET_HIT_NORMALIZED: f64 = 0.1;
const PIRATE_SPAWN_DIST: f64 = 100.0;
const PIRATE_SPAWN_COUNT: usize = 1;
const PIRATE_SPAWN_INTERVAL_TICKS: u32 = 3 * 1000 * 1000;

pub fn on_ship_docked(state: &mut GameState, ship: Ship, planet: PlanetV2) {
    if ship
        .abilities
        .iter()
        .any(|a| matches!(a, Ability::BlowUpOnLand))
    {
        // remove ship immediately
        indexing::find_and_extract_ship_by_id(state, ship.id);
        if let Some(planet) = indexing::find_planet_mut(state, &planet.id) {
            if let Some(health) = &mut planet.health {
                health.current =
                    (health.current - health.max * SHIP_PLANET_HIT_NORMALIZED).max(0.0);
                if health.current <= 0.0 {
                    state.game_over = Some(GameOver {
                        reason: format!("Your planet {} was captured by pirates. All is lost, and you have been defeated.", planet.name),
                    })
                }
            }
        }
    }
}

pub fn on_ship_died(state: &mut GameState, ship: Ship) {
    if let Some(prop) = ship
        .properties
        .iter()
        .find(|a| matches!(a, ObjectProperty::MoneyOnKill { .. }))
    {
        match prop {
            ObjectProperty::MoneyOnKill(props) => {
                if let Some(killer) = ship.health.last_damage_dealer {
                    let player_id = match killer {
                        ObjectSpecifier::Ship { id } => {
                            let mapping = index_players_by_ship_id(&state.players);
                            if let Some(player) = mapping.get(&id) {
                                Some(player.id)
                            } else {
                                None
                            }
                        }
                        _ => None,
                    };
                    if let Some(player_id) = player_id {
                        if let Some(player) = state.players.iter_mut().find(|p| p.id == player_id) {
                            player.money += props.amount;
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

pub fn update_state_pirate_defence(state: &mut GameState, prng: &mut Pcg64Mcg) {
    let current_ticks = state.ticks as u32;
    if world::every(
        PIRATE_SPAWN_INTERVAL_TICKS,
        current_ticks,
        state
            .interval_data
            .as_ref()
            .and_then(|id| id.get(&TimeMarks::PirateSpawn))
            .map(|m| *m),
    ) {
        let target_count = PIRATE_SPAWN_COUNT * state.players.len();
        state
            .interval_data
            .as_mut()
            .map(|id| id.insert(TimeMarks::PirateSpawn, current_ticks));
        for _i in 0..target_count {
            fire_saved_event(
                state,
                GameEvent::PirateSpawn {
                    state_id: state.id,
                    at: gen_pirate_spawn(&state.locations[0].planets.get(0).unwrap(), prng),
                },
            );
        }
    }
}

pub fn gen_pirate_spawn(planet: &&PlanetV2, prng: &mut Pcg64Mcg) -> Vec2f64 {
    let angle = prng.gen_range(0.0, PI * 2.0);
    let vec = Vec2f64 { x: 1.0, y: 0.0 };
    vec.rotate(angle)
        .scalar_mul(PIRATE_SPAWN_DIST)
        .add(&Vec2f64 {
            x: planet.spatial.position.x,
            y: planet.spatial.position.y,
        })
}

pub fn on_create_room(room: &mut Room, prng: &mut Pcg64Mcg) {
    let traits = Some(vec![AiTrait::PirateDefencePlanetDefender]);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
    add_bot(room, new_bot(traits.clone(), prng_id(prng)), prng);
}

pub fn bot_planet_defender_act(
    bot: Bot,
    state: &GameState,
    _bot_elapsed_micro: i64,
    _d_table: &DialogueTable,
    spatial_indexes: &SpatialIndexes,
    prng: &mut Pcg64Mcg,
) -> (Bot, Vec<BotAct>) {
    let bot_id = bot.id;
    let nothing = (bot.clone(), vec![]);
    let ship_loc = find_player_ship_index(state, bot.id);
    if let Some(ship_loc) = ship_loc {
        if let Some(loc_sp_idx) = spatial_indexes.values.get(&ship_loc.location_idx) {
            let my_ship = &state.locations[ship_loc.location_idx].ships[ship_loc.ship_idx];
            let valid_targets = loc_sp_idx.rad_search(&my_ship.as_vec(), SHOOT_DEFAULT_DISTANCE);
            let mut all_acts = vec![];

            let foe_ships = valid_targets
                .iter()
                .filter_map(|sp| match sp {
                    ObjectIndexSpecifier::Ship { idx } => {
                        let target_ship = &state.locations[ship_loc.location_idx].ships[*idx];
                        let is_foe = target_ship
                            .npc
                            .clone()
                            .map(|n| {
                                n.traits
                                    .iter()
                                    .any(|t| matches!(t, AiTrait::ImmediatePlanetLand))
                            })
                            .map_or(false, |t| t);
                        if is_foe {
                            Some(target_ship)
                        } else {
                            None
                        }
                    }
                    _ => None,
                })
                .collect::<Vec<_>>();
            if let Some(first) = foe_ships.first() {
                for turret_ab in my_ship
                    .abilities
                    .iter()
                    .filter(|a| matches!(a, Ability::Shoot { .. }))
                {
                    if turret_ab.get_current_cooldown() == 0 {
                        let act = Action::LongActionStart {
                            long_action_start: LongActionStart::Shoot {
                                target: ObjectSpecifier::Ship { id: first.id },
                                turret_id: match turret_ab {
                                    Ability::Shoot { turret_id, .. } => turret_id.clone(),
                                    _ => Default::default(),
                                },
                            },
                            player_id: Some(bot_id),
                            ship_id: my_ship.id,
                        };
                        all_acts.push(BotAct::Act(act));
                    }
                }
            }
            let def_planet = &state.locations[0].planets[0];
            let rad = def_planet.spatial.radius;
            if my_ship
                .as_vec()
                .euclidean_distance(&def_planet.spatial.position)
                > rad * 1.5
                && my_ship.trajectory.len() == 0
            {
                let random_shift_x = prng.gen_range(-rad, rad);
                let random_shift_y = prng.gen_range(-rad, rad);
                all_acts.push(BotAct::Act(Action::Navigate {
                    ship_id: my_ship.id,
                    target: def_planet.spatial.position.add(&Vec2f64 {
                        x: random_shift_x,
                        y: random_shift_y,
                    }),
                }));
            }
            return (bot, all_acts);
        }
    }

    return nothing;
}

pub fn friend_or_foe_p2o(
    _state: &GameState,
    _player_id: Uuid,
    object_b: ObjectIndexSpecifier,
) -> FriendOrFoe {
    match object_b {
        ObjectIndexSpecifier::Planet { .. } => {
            // all players friendly by default, although I've made a property PirateDefencePlayersHomePlanet for distinguishing
            FriendOrFoe::Friend
        }
        ObjectIndexSpecifier::Ship { .. } => {
            // if we are here, then it's not a player's ship, therefore hostile
            FriendOrFoe::Foe
        }
        _ => FriendOrFoe::Neutral,
    }
}

pub fn friend_or_foe(
    state: &GameState,
    actor_a: FofActor,
    actor_b: FofActor,
    loc_idx: usize,
) -> FriendOrFoe {
    // turn ships into players
    let player_a = fof::resolve_player_id(&actor_a, state, loc_idx);
    let player_b = fof::resolve_player_id(&actor_b, state, loc_idx);
    // all players & their ships are friendly
    if player_a.is_some() && player_b.is_some() {
        return FriendOrFoe::Friend;
    }

    // all other stuff is neutral to each other
    if player_a.is_none() && player_b.is_none() {
        match &actor_a {
            FofActor::Player { .. } => {}
            FofActor::ObjectIdx { spec } => match spec {
                ObjectIndexSpecifier::Projectile { .. } => {
                    match &actor_b {
                        FofActor::Player { .. } => {}
                        FofActor::ObjectIdx { spec } => {
                            match spec {
                                ObjectIndexSpecifier::Ship { idx } => {
                                    if find_property(
                                        &&state.locations[loc_idx].ships[*idx].properties,
                                        ObjectPropertyKey::PirateShip,
                                    )
                                    .is_some()
                                    {
                                        // rockets, no matter from whom (assuming only players can shoot for now)
                                        // are hostile to pirate ships
                                        return FriendOrFoe::Foe;
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
                _ => {}
            },
        };
        return FriendOrFoe::Neutral;
    }
    if player_b.is_some() {
        match actor_a {
            FofActor::Player { .. } => {}
            FofActor::ObjectIdx { spec } => {
                return friend_or_foe_p2o(state, player_b.unwrap(), spec);
            }
        }
    } else if player_a.is_some() {
        match actor_b {
            FofActor::Player { .. } => {}
            FofActor::ObjectIdx { spec } => {
                return friend_or_foe_p2o(state, player_a.unwrap(), spec);
            }
        }
    }
    panic!("pirate_defence::friend_or_foe - Impossible combination of data")
}
