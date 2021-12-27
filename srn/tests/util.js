import { getBindgen, wasm_bindgen as init } from '../world/pkg-nomodule/world';
import _ from 'lodash';

const fs = require('fs-extra');
export const wasm = {
  updateWorld: () => {},
  seedWorld: () => {},
  createRoom: () => {},
  updateRoom: () => {},
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

export const loadWasm = async function () {
  const resources = await loadResources('../server/resources');
  const wasmBytes = await fs.readFile('../world/pkg-nomodule/world_bg.wasm');
  await init(wasmBytes);
  const wasmFunctions = getBindgen();
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
  wasm.updateWorld = serializedWasmCaller(wasmFunctions.update_world);
  wasm.seedWorld = serializedWasmCaller(wasmFunctions.seed_world);
  wasm.createRoom = wasmFunctions.create_room;
  wasm.updateRoom = wasmFunctions.update_room;
  wasm.makeDialogueTable = wasmFunctions.make_dialogue_table;
  wasm.resources = resources;
  wasm.dialogueTable = wasm.makeDialogueTable(wasm.resources.dialogue_scripts);
  return wasmFunctions;
};
export const updateWholeWorld = (world, millis, isServer = true) => {
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

// default timeStep for tests is 100 * 1000mcs = 100ms
export const updateRoom = (room, millis, timeStepTicks = 100n * 1000n) => {
  let remaining = BigInt(millis * 1000);
  let currentRoom = room;
  while (remaining > 0) {
    remaining -= timeStepTicks;
    currentRoom = wasm.updateRoom(
      currentRoom,
      timeStepTicks,
      wasm.dialogueTable
    );
  }
  return currentRoom;
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

const getLoc0 = (world) => world.locations[0];
