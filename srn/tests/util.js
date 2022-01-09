import { getBindgen, wasm_bindgen as init } from '../world/pkg-nomodule/world';
import _ from 'lodash';
import { timerifySync } from './perf';

const fs = require('fs-extra');
const notLoadedError = 'wasm did not load, call await loadWasm() first';
const { timerify, flushPerfStats } = require('./perf');

// pretty hacky solution of importing specially-cooked client code here, but workable.
// technically, it should be inside pkg, and code-generated (or provided together with it, rather)
// or even just be part of wasm itself, as it will eventually become to be fast enough,
// e.g. when I will want the full spatial indexes on the client
import {
  buildClientStateIndexes,
  findObjectPosition,
} from '../client/src/ClientStateIndexing';

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
};
const serializedWasmCaller = (fn) => (args, ...extraArgs) => {
  const result = JSON.parse(fn(JSON.stringify(args), ...extraArgs));
  if (result.message) {
    throw new Error(result.message);
  }
  return result;
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

export const loadWasm = timerify(async function loadWasm() {
  const resources = await loadResources('../server/resources');
  const wasmBytes = await fs.readFile('../world/pkg-nomodule/world_bg.wasm');
  await init(wasmBytes);
  const wasmFunctions = getBindgen();
  wasmFunctions.set_panic_hook();
  wasmFunctions.set_enable_perf(!!process.env.ENABLE_PERF);
  wasm.updateWorld = serializedWasmCaller(wasmFunctions.update_world);
  wasm.seedWorld = serializedWasmCaller(wasmFunctions.seed_world);
  wasm.createRoom = wasmFunctions.create_room;
  wasm.updateRoom = wasmFunctions.update_room;
  wasm.updateRoomFull = wasmFunctions.update_room_full;
  wasm.flushSamplerStats = wasmFunctions.flush_sampler_stats;
  wasm.makeDialogueTable = wasmFunctions.make_dialogue_table;
  wasm.resources = resources;
  wasm.dialogueTable = wasm.makeDialogueTable(wasm.resources.dialogue_scripts);
  return wasmFunctions;
});
export const updateWorld = (world, millis, isServer = true) => {
  return wasm.updateWorld(
    {
      state: world,
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
    },
    BigInt(millis * 1000)
  );
};

export const updateRoom = timerifySync(function updateRoomV2(
  room,
  millis,
  timeStepTicks = 100n * 1000n // 100ms. Much slower than the actual game, but ok for the testing performance
) {
  let currentRoom = room;
  currentRoom = wasm.updateRoomFull(
    currentRoom,
    BigInt(millis * 1000),
    wasm.dialogueTable,
    timeStepTicks
  );
  return currentRoom;
});

export const exposePerfStats = () => {
  flushPerfStats();
  wasm.flushSamplerStats();
};

export const mockShip = (id) => ({
  id,
  x: 0,
  y: 0,
  rotation: 0,
  radius: 1,
  acc_periodic_dmg: 0,
  acc_periodic_heal: 0,
  color: 'red',
  trajectory: [],
  inventory: [],
  abilities: [],
  movement_markers: {},
  movement_definition: {
    tag: 'Unknown',
  },
  health: {
    current: 10,
    max: 10,
  },
  local_effects: [],
  long_actions: [],
  turrets: [],
});

export function findFirstEvent(world, eventName) {
  return world.events.find((e) => e.tag === eventName);
}

export function findFirstProcessedEvent(world, eventName) {
  return world.processed_events.find((e) => e.event.tag === eventName);
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

export { findObjectPosition };
