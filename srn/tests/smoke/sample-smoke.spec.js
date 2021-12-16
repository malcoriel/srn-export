const fs = require('fs');
import {
  getBindgen,
  wasm_bindgen as init,
} from '../../world/pkg-nomodule/world';

let updateWorld;
let seedWorld;

const serializedWasmCaller = (fn) => (args, ...extraArgs) => {
  return JSON.parse(fn(JSON.stringify(args), ...extraArgs));
};

const loadWasm = async function () {
  const wasmBytes = fs.readFileSync('../world/pkg-nomodule/world_bg.wasm');
  await init(wasmBytes);
  const wasmFunctions = getBindgen();
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
  updateWorld = serializedWasmCaller(wasmFunctions.update_world);
  seedWorld = serializedWasmCaller(wasmFunctions.seed_world);
  return wasmFunctions;
};

const updateWholeWorld = (world, millis, isServer = true) => {
  return updateWorld(
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

describe('sample smoke test', () => {
  beforeAll(loadWasm);

  it('can seed and update world', async () => {
    let world = seedWorld({ mode: 'PirateDefence', seed: '123' });
    expect(world.mode).toEqual('PirateDefence');
    expect(world.seed).toEqual('123');
    world = updateWholeWorld(world, 100);
    expect(world.millis).toEqual(100);
  });

  it('can rotate planet', async () => {
    let world = seedWorld({ mode: 'PirateDefence', seed: '123' });
    expect(world.mode).toEqual('PirateDefence');
    expect(world.seed).toEqual('123');
    const oldX = world.locations[0].planets[0].x;
    world = updateWholeWorld(world, 1000);
    expect(world.locations[0].planets[0].x).not.toBeCloseTo(oldX);
  });
});
