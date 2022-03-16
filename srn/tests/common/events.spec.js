import {
  findFirstProcessedEvent,
  mockPlayer,
  mockShip,
  swapGlobals,
  updateWorld,
  wasm,
} from '../util';
import * as uuid from 'uuid';

describe('game events logic', () => {
  beforeAll(swapGlobals);

  it('can blow up ship', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    const shipId = uuid.v4();
    world.locations[0].ships.push(mockShip(shipId));
    world = updateWorld(world, 10 * 1000);
    expect(world.locations[0].ships.length).toEqual(0);
    const shipDiedEvent = findFirstProcessedEvent(world, 'ShipDied');
    expect(shipDiedEvent).toBeTruthy();
    expect(shipDiedEvent.event.ship.id).toEqual(shipId);
  });

  it('can spawn pirates', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    // pirates spawn only if there are players
    world.players.push(mockPlayer(uuid.v4()));
    world = updateWorld(world, 15 * 1000);
    const pirateSpawnEvent = findFirstProcessedEvent(world, 'PirateSpawn');
    expect(pirateSpawnEvent.event.state_id).toEqual(world.id);
    const ships = world.locations[0].ships;
    expect(ships.length).toBeGreaterThan(1);
  });
});
