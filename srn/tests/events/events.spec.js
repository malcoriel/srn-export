import { loadWasm, updateWholeWorld, wasm } from '../util';
import * as uuid from 'uuid';

const mockShip = (id) => ({
  id,
  x: 0,
  y: 0,
  rotation: 0,
  radius: 1,
  acc_periodic_dmg: 0,
  acc_periodic_heal: 0,
  color: 'red',
  trajectory: [],
  inventory: [],
  abilities: [],
  movement_markers: {},
  movement_definition: {
    tag: 'Unknown',
  },
  health: {
    current: 10,
    max: 10,
  },
  local_effects: [],
  long_actions: [],
  turrets: [],
});

describe('sample smoke test', () => {
  beforeAll(loadWasm);

  it('can blow up ship', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    const shipId = uuid.v4();
    world.locations[0].ships.push(mockShip(shipId));
    world = updateWholeWorld(world, 10 * 1000);
    expect(world.locations[0].ships.length).toEqual(0);
    const shipDiedEvent = world.events.find((e) => e.tag === 'ShipDied');
    expect(shipDiedEvent.ship.id).toEqual(shipId);
  });
});
