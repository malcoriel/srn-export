// noinspection ES6CheckImport
import { getBindgen, wasm_bindgen as init } from '../world/pkg-nomodule/world';
import _ from 'lodash';
import { timerifySync } from './perf';
// pretty hacky solution of importing specially-cooked client code here, but workable.
// technically, it should be inside pkg, and code-generated (or provided together with it, rather)
// or even just be part of wasm itself, as it will eventually become to be fast enough,
// e.g. when I will want the full spatial indexes on the client
import {
  buildClientStateIndexes,
  findObjectPosition,
} from '../client/src/ClientStateIndexing';
import * as uuid from 'uuid';

require('util').inspect.defaultOptions.depth = 5;

const fs = require('fs-extra');
const notLoadedError = 'wasm did not load, call await loadWasm() first';
const { timerify, flushPerfStats } = require('./perf');

export const wasm = {
  updateWorld: () => {
    throw new Error(notLoadedError);
  },
  seedWorld: () => {
    throw new Error(notLoadedError);
  },
  createRoom: () => {
    throw new Error(notLoadedError);
  },
  updateRoom: () => {
    throw new Error(notLoadedError);
  },
  updateRoomFull: () => {
    throw new Error(notLoadedError);
  },
  friendOrFoe: () => {
    throw new Error(notLoadedError);
  },
  packReplay: () => {
    throw new Error(notLoadedError);
  },
  getDiffReplayStateAt: () => {
    throw new Error(notLoadedError);
  },
  getPreloadedDiffReplayStateAt: () => {
    throw new Error(notLoadedError);
  },
  getPreloadedDiffReplayStateAtInterpolated: () => {
    throw new Error(notLoadedError);
  },
  applySinglePatch: () => {
    throw new Error(notLoadedError);
  },
  loadReplay: () => {
    throw new Error(notLoadedError);
  },
  interpolateStates: () => {
    throw new Error(notLoadedError);
  },
  buildDialogueFromState: () => {
    throw new Error(notLoadedError);
  },
  getNanosNode: () => {
    throw new Error(notLoadedError);
  },
  getNanosWeb: () => {
    throw new Error(notLoadedError);
  },

  guideProjectile: () => {
    throw new Error(notLoadedError);
  },
};

const loadAllJsonsAsRawStringsKeyByFilename = async (path) => {
  const pairs = await Promise.all(
    fs
      .readdirSync(path)
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => {
        const contents = await fs.readFile(`${path}/${f}`);
        return [f.replace(/\.json$/, ''), contents.toString()];
      })
  );
  return _.fromPairs(pairs);
};

const loadResources = async (path) => {
  const res = {};
  res.dialogue_scripts = await loadAllJsonsAsRawStringsKeyByFilename(
    `${path}/dialogue_scripts`
  );
  res.saved_states = await loadAllJsonsAsRawStringsKeyByFilename(
    `${path}/saved_states`
  );
  return res;
};

export const swapGlobals = () => {
  if (global.wasm) {
    _.assign(wasm, global.wasm);
  }
};

export const genStateOpts = (overrides) =>
  _.merge(
    {
      system_count: 1,
      max_planets_in_system: 10,
      max_satellites_for_planet: 3,
    },
    overrides
  );

export const loadWasm = timerify(async function loadWasm() {
  try {
    const resources = await loadResources('../server/resources');
    const wasmBytes = await fs.readFile('../world/pkg-nomodule/world_bg.wasm');
    await init(wasmBytes);
    const wasmFunctions = getBindgen();
    wasmFunctions.set_panic_hook();
    wasmFunctions.set_enable_perf(!!process.env.ENABLE_PERF);
    wasm.updateWorld = wasmFunctions.update_world;
    wasm.updateWorldIncremental = wasmFunctions.update_world_incremental;
    wasm.seedWorld = wasmFunctions.seed_world;
    wasm.createRoom = wasmFunctions.create_room;
    wasm.updateRoom = wasmFunctions.update_room;
    wasm.updateRoomFull = wasmFunctions.update_room_full;
    wasm.friendOrFoe = wasmFunctions.friend_or_foe;
    wasm.flushSamplerStats = wasmFunctions.flush_sampler_stats;
    wasm.makeDialogueTable = wasmFunctions.make_dialogue_table;
    wasm.packReplay = wasmFunctions.pack_replay;
    wasm.loadReplay = wasmFunctions.load_replay;
    wasm.generatePhaseTable = wasmFunctions.generate_phase_table;
    wasm.getDiffReplayStateAt = timerifySync(function getDiffReplayStateAt(
      ...args
    ) {
      return wasmFunctions.get_diff_replay_state_at(...args);
    });
    wasm.getPreloadedDiffReplayStateAtInterpolated =
      wasmFunctions.get_preloaded_diff_replay_state_at_interpolated;
    wasm.getPreloadedDiffReplayStateAt = timerifySync(
      function getPreloadedDiffReplayStateAt(...args) {
        return wasmFunctions.get_preloaded_diff_replay_state_at(...args);
      }
    );
    wasm.applySinglePatch = wasmFunctions.apply_single_patch;
    wasm.interpolateStates = wasmFunctions.interpolate_states;
    wasm.buildDialogueFromState = wasmFunctions.build_dialogue_from_state;
    wasm.getNanosNode = wasmFunctions.get_nanos_node;
    wasm.getNanosWeb = wasmFunctions.get_nanos_web;
    wasm.guideProjectile = wasmFunctions.guide_projectile;
    wasm.resources = resources;
    wasm.dialogueTable = wasm.makeDialogueTable(
      wasm.resources.dialogue_scripts
    );
    wasm.buildTrajectory = wasmFunctions.build_trajectory;
    wasmFunctions.load_d_table(wasm.dialogueTable);
    return wasmFunctions;
  } catch (e) {
    console.error('loading wasm failed', e);
  }
});

function makeUpdateWorldArgs(isServer, forceNonDeterminism) {
  return {
    limit_area: {
      top_left: {
        x: -1000,
        y: -1000,
      },
      bottom_right: {
        x: 1000,
        y: 1000,
      },
    },
    client: !isServer,
    force_non_determinism: forceNonDeterminism,
  };
}

export const updateWorld = (
  world,
  millis,
  isServer = true,
  forceNonDeterminism = false,
  stateTag = undefined
) => {
  return wasm.updateWorld(
    {
      state: world,
      ...makeUpdateWorldArgs(isServer, forceNonDeterminism),
      state_tag: stateTag,
    },
    millis * 1000
  );
};

export const updateWorldIncremental = (
  stateTag,
  millis,
  isServer = true,
  forceNonDeterminism = false
) => {
  return wasm.updateWorldIncremental(
    {
      state_tag: stateTag,
      ...makeUpdateWorldArgs(isServer, forceNonDeterminism),
    },
    millis * 1000
  );
};

export const updateRoom = timerifySync(function updateRoomV2(
  room,
  millis,
  timeStepTicks = 100 * 1000 // 100ms. Much slower than the actual game, but ok for the testing performance
) {
  let currentRoom = room;
  currentRoom = wasm.updateRoomFull(currentRoom, millis * 1000, timeStepTicks);
  return currentRoom;
});

export const exposePerfStats = () => {
  flushPerfStats();
  wasm.flushSamplerStats();
};

export const mockNone = () => ({
  tag: 'None',
});
export const mockHealth = (max) => ({
  current: max,
  max,
  acc_periodic_dmg: 0,
  acc_periodic_heal: 0,
});

export const mockAsteroid = () => ({
  id: uuid.v4(),
  spatial: {
    position: {
      x: 0,
      y: 0,
    },
    angular_velocity: 0,
    velocity: {
      x: 0,
      y: 0,
    },
    rotation_rad: 0,
    radius: 1,
  },
  movement: mockNone(),
  health: mockHealth(50),
  rot_movement: mockNone(),
  to_clean: false,
});

export const mockShip = (id) => ({
  id,
  spatial: {
    position: {
      x: 0,
      y: 0,
    },
    angular_velocity: 0,
    velocity: {
      x: 0,
      y: 0,
    },
    rotation_rad: Math.PI,
    radius: 1,
  },
  color: 'red',
  trajectory: [],
  inventory: [],
  abilities: [],
  movement_markers: {},
  movement_definition: {
    tag: 'ShipMonotonous',
    move_speed: 10.0 / 1000 / 1000,
    turn_speed: 1.0,
    current_move_speed: 0.0,
    current_turn_speed: 0.0,
  },
  health: {
    current: 10,
    max: 10,
    acc_periodic_dmg: 0,
    acc_periodic_heal: 0,
  },
  local_effects: [],
  local_effects_counter: 0,
  long_actions: [],
  turrets: [],
  properties: [],
});

// noinspection JSUnusedGlobalSymbols
export function findFirstEvent(world, eventName) {
  return world.events.find((e) => e.tag === eventName);
}

export function findFirstProcessedEvent(world, eventName) {
  return world.processed_events.find((e) => e.tag === eventName);
}

export function mockPlayer(player_id) {
  return {
    id: player_id,
    name: 'test',
    is_bot: false,
    money: 0,
    portrait_name: '1',
    respawn_ms_left: 0,
    long_actions: [],
    notifications: [],
  };
}

export const getLoc0 = (world) => world.locations[0];
export const getShipByPlayerId = (world, playerId) => {
  const indexes = buildClientStateIndexes(world);
  return indexes.shipByPlayerId.get(playerId);
};

export const getShipIdxByPlayerId = (world, playerId) => {
  const s = getShipByPlayerId(world, playerId);
  return getLoc0(world).ships.indexOf(s);
};

export { findObjectPosition };
export const objSpecShip = (id) => ({
  tag: 'Ship',
  id,
});
export const objIdxSpecAsteroid = (idx) => ({
  tag: 'Asteroid',
  idx,
});
export const objIdxSpecShip = (idx) => ({
  tag: 'Ship',
  idx,
});
export const objSpecPlanet = (id) => ({
  tag: 'Planet',
  id,
});
export const objIdxSpecPlanet = (idx) => ({
  tag: 'Planet',
  idx,
});
export const fofActorPlayer = (id) => ({
  tag: 'Player',
  id,
});
export const fofActorShip = (idx) => ({
  tag: 'ObjectIdx',
  spec: objIdxSpecShip(idx),
});

export const fofActorAsteroid = (idx) => ({
  tag: 'ObjectIdx',
  spec: objIdxSpecAsteroid(idx),
});

export const fofActorPlanet = (id) => ({
  tag: 'ObjectIdx',
  spec: objIdxSpecPlanet(id),
});
export const findAPirateShip = (loc) =>
  loc.ships.find((s) => {
    return _.some(s.properties, (p) => p.tag === 'PirateShip');
  });
export const updatePirateDefenceUntilPiratesAppear = (
  room,
  intervalMs = 3000,
  timeoutMs = 30_000
) => {
  let currRoom = room;
  let timePassed = 0;
  while (timePassed <= timeoutMs) {
    timePassed += intervalMs;
    currRoom = updateRoom(currRoom, intervalMs);
    if (findAPirateShip(getLoc0(currRoom.state))) {
      return currRoom;
    }
  }
  throw new Error('Timeout updating room until pirates appear');
};

export const writeReplay = async (replay) => {
  await fs.writeJson(`../server/resources/replays/${replay.id}.json`, replay, {
    spaces: 2,
  });
};

export const writeTmpJson = async (tmp, data) => {
  await fs.mkdirp('./.tmp');
  await fs.writeJson(`./.tmp/${tmp}.json`, data, {
    spaces: 2,
  });
};

export const packAndWriteReplay = async (states, name) => {
  const replay = {
    id: uuid.v4(),
    name,
    initial_state: states[0],
    frames: _.fromPairs(
      states.map((s) => [
        s.ticks,
        {
          ticks: s.ticks,
          state: s,
        },
      ])
    ),
    current_state: null,
    max_time_ms: states[states.length - 1].millis,
    current_millis: 0,
    marks: states.map((s) => s.ticks),
  };
  await writeReplay(replay);
};
export const mockUpdateOptions = (overrides) => _.merge({}, overrides);

export const createStateWithAShip = (mode = 'CargoRush') => {
  const state = wasm.seedWorld({
    seed: 'player actions',
    mode,
    gen_state_opts: genStateOpts({ system_count: 1 }),
  });
  const player = mockPlayer(uuid.v4());
  state.players.push(player);
  const ship = mockShip(uuid.v4());
  player.ship_id = ship.id;
  const loc = getLoc0(state);
  loc.ships.push(ship);
  // to not blow up due to being in the star
  ship.spatial.position.x = 100;
  ship.spatial.position.y = 100;
  return {
    state,
    player,
    ship,
    planet: getLoc0(state).planets[0],
  };
};
