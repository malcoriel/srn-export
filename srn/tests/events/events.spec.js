import {
  findFirstEvent,
  findFirstProcessedEvent,
  loadWasm,
  mockPlayer,
  mockShip,
  updateWholeWorld,
  wasm,
} from '../util';
import * as uuid from 'uuid';
import * as _ from 'lodash';

describe('game events logic', () => {
  beforeAll(loadWasm);

  it('can blow up ship', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    const shipId = uuid.v4();
    world.locations[0].ships.push(mockShip(shipId));
    world = updateWholeWorld(world, 10 * 1000);
    expect(world.locations[0].ships.length).toEqual(0);
    const shipDiedEvent = findFirstEvent(world, 'ShipDied');
    expect(shipDiedEvent.ship.id).toEqual(shipId);
  });

  it('can spawn pirates', async () => {
    let world = wasm.seedWorld({ mode: 'PirateDefence', seed: '123' });
    // pirates spawn only if there are players
    world.players.push(mockPlayer(uuid.v4()));
    world = updateWholeWorld(world, 15 * 1000);
    console.log(_.pick(world, ['events', 'processed_events']));
    const pirateSpawnEvent = findFirstEvent(world, 'PirateSpawn');
    expect(pirateSpawnEvent.state_id).toEqual(world.id);
    world = updateWholeWorld(world, 1000);
    console.log(_.pick(world, ['events', 'processed_events']));
    const ships = world.locations[0].ships;
    expect(ships.length).toBeGreaterThan(1);
    const processedEvent = findFirstProcessedEvent(world, 'PirateSpawn');
    expect(processedEvent.processed_at_ticks).toBeGreaterThan(15 * 1000 * 1000);
  });
});
