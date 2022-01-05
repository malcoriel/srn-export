import { updateRoom, wasm, swapGlobals, getLoc0 } from '../util';
import _ from 'lodash';

describe('pirate defence bots behavior', () => {
  beforeAll(swapGlobals);
  it('can spawn some default bots', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state: world } = room;
    expect(world.players.length).toBeGreaterThan(0);
    expect(_.every(world.players, (p) => p.is_bot)).toBeTruthy();
  });

  it('npcs damage the planets after some time', async () => {
    let room = wasm.createRoom({ mode: 'PirateDefence' });
    room = updateRoom(room, 30 * 1000);
    const planet = getLoc0(room.state).planets[0];
    expect(planet.health.current).toBeLessThan(planet.health.max);
  });

  it('bots shoot npcs and earn money', () => {
    let room = wasm.createRoom({ mode: 'PirateDefence' });
    room = updateRoom(room, 30 * 1000);
    expect(room.state.players[0].money).toBeGreaterThan(0);
  });
});
