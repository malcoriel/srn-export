import { createStateWithAShip, swapGlobals, updateWorld } from '../util';

describe('health effects', () => {
  beforeAll(swapGlobals);
  it("can blow ship when it's on a star", () => {
    // eslint-disable-next-line prefer-const
    let { state, ship } = createStateWithAShip('CargoRush');
    ship.spatial.position.x = 0.0;
    ship.spatial.position.y = 0.0;
    state = updateWorld(state, 10 * 1000);
    console.log(state.locations[0].ships[0]);
    expect(state.locations[0].ships.length).toEqual(0);
  });
});
