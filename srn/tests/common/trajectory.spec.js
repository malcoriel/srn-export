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
    const max_linear_speed = 20.0 / 1000.0 / 1000.0;
    const max_angular_speed = Math.PI / 2.0 / 1000.0 / 1000.0;
    ship.movement_definition = {
      tag: 'ShipAccelerated',
      max_linear_speed,
      max_rotation_speed: max_angular_speed,
      linear_drag: (max_linear_speed * 0.025) / 1e6, // 2.5% per second
      acc_linear: (max_linear_speed * 0.25) / 1e6, // 25% per second
      max_turn_speed: max_angular_speed,
      brake_acc: max_angular_speed / 1e6,
      acc_angular: max_angular_speed * 0.0125,
    };
    wasm.buildTrajectory(
      {
        tag: 'StartAndStop',
        to: {
          x: 110,
          y: 100,
        },
      },
      ship.movement_definition,
      ship.spatial
    );
  });
});
