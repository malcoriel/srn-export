import { getBindgen, wasm_bindgen as init } from '../world/pkg-nomodule/world';

const fs = require('fs');
export const wasm = {
  updateWorld: () => {},
  seedWorld: () => {},
};
const serializedWasmCaller = (fn) => (args, ...extraArgs) => {
  const result = JSON.parse(fn(JSON.stringify(args), ...extraArgs));
  if (result.message) {
    throw new Error(result.message);
  }
  return result;
};

export const loadWasm = async function () {
  const wasmBytes = fs.readFileSync('../world/pkg-nomodule/world_bg.wasm');
  await init(wasmBytes);
  const wasmFunctions = getBindgen();
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
  wasm.updateWorld = serializedWasmCaller(wasmFunctions.update_world);
  wasm.seedWorld = serializedWasmCaller(wasmFunctions.seed_world);
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
