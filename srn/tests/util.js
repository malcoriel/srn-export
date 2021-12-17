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
