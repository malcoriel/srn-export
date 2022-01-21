import { swapGlobals, updateWorld, wasm } from '../util';

describe('sample smoke test', () => {
  beforeAll(swapGlobals);

  it('can seed and update world', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    expect(world.mode).toEqual('PirateDefence');
    expect(world.seed).toEqual('123');
    world = updateWorld(world, 100);
    expect(world.millis).toEqual(96);
  });

  it('can rotate planet', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    expect(world.mode).toEqual('PirateDefence');
    expect(world.seed).toEqual('123');
    const oldX = world.locations[0].planets[0].x;
    world = updateWorld(world, 1000);
    expect(world.locations[0].planets[0].x).not.toBeCloseTo(oldX);
  });
});
