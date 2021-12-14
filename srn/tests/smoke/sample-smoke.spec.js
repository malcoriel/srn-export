const loadWasm = async function () {
  const wasmFunctions = await import('../../world/pkg');
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
  return wasmFunctions;
};

describe('sample smoke test', () => {
  let updateWorld;
  let seedWorld;

  beforeAll(async () => {
    const wasm = await loadWasm();
    updateWorld = wasm.update_world;
    seedWorld = wasm.seed_world;
  });

  it('can updateWorld', async () => {
    let world = seedWorld('123');
    world = updateWorld(world, 100);
  });
});
