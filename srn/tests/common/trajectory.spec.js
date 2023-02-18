import {
  createStateWithAShip,
  mockPlayer,
  swapGlobals,
  updateWorld,
  wasm,
} from '../util';
import * as uuid from 'uuid';

const getLoc0 = (world) => world.locations[0];

describe('trajectory building', () => {
  beforeAll(swapGlobals);

  it('can build trajectory from A to B', async () => {
    const { state, player, ship } = createStateWithAShip('Sandbox');
    ship.spatial.position = {
      x: 100,
      y: 100,
    };
    wasm.buildTrajectory(
      {
        tag: 'StartAndStop',
        to: {
          x: 110,
          y: 100,
        },
      },
      ship.movement,
      ship.spatial
    );
  });
});
