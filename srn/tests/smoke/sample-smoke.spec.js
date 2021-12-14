const fs = require('fs');
import { wasm_bindgen as init, getBindgen } from '../../world/experiment/world';

let updateWorld;
let seedWorld;

const serializedWasmCaller = (fn) => (args) => {
  return JSON.parse(fn(JSON.stringify(args)));
};

const loadWasm = async function () {
  const wasmBytes = fs.readFileSync('../world/experiment/world_bg.wasm');
  await init(wasmBytes);
  const wasmFunctions = getBindgen();
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
  updateWorld = serializedWasmCaller(wasmFunctions.update_world);
  seedWorld = serializedWasmCaller(wasmFunctions.seed_world);
  return wasmFunctions;
};

describe('sample smoke test', () => {
  beforeAll(loadWasm);

  it('can updateWorld', async () => {
    let world = seedWorld({ mode: 'PirateDefence', seed: '123' });
    expect(world.mode).toEqual('PirateDefence');
    expect(world.seed).toEqual('123');
    // world = updateWorld(world, 100);
    // console.log('after', world);
  });
});
