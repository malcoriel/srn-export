import { mockPlayer, swapGlobals, updateWorld, wasm } from '../util';
import * as uuid from 'uuid';

const getLoc0 = (world) => world.locations[0];

describe('respawn logic', () => {
  beforeAll(swapGlobals);

  it("can respawn player's ship when there is none", async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    world.players.push(mockPlayer(uuid.v4()));
    world = updateWorld(world, 1);
    world = updateWorld(world, 30 * 1000);
    const ship = getLoc0(world).ships[0];
    expect(ship).toBeTruthy();
    expect(ship.id).toEqual(world.players[0].ship_id);
  });
});
