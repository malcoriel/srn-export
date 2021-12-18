import { loadWasm, mockPlayer, updateWholeWorld, wasm } from '../util';
import * as uuid from 'uuid';

const getLoc0 = (world) => world.locations[0];

describe('cargo rush bots behavior', () => {
  beforeAll(loadWasm);

  it('can spawn some default bots', async () => {
    const world = wasm.seedWorld({ mode: 'CargoRush', seed: '123' });
    updateWholeWorld(world, 1);
    expect(world.players.length).toBeGreaterThan(0);
  });
});
