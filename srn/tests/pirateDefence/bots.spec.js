import {
  updateRoom,
  wasm,
  swapGlobals,
  getLoc0,
  findObjectPosition,
  getShipByPlayerId,
} from '../util';
import _ from 'lodash';
import Vector from '../../client/src/utils/Vector';

describe('pirate defence bots behavior', () => {
  beforeAll(swapGlobals);
  it('can spawn some default bots', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence', seed: 'bots' });
    const { state: world } = room;
    expect(world.players.length).toBeGreaterThan(0);
    expect(_.every(world.players, (p) => p.is_bot)).toBeTruthy();
  });

  it('npcs damage the planets after some time', async () => {
    let room = wasm.createRoom({ mode: 'PirateDefence', seed: 'bots' });
    room.bots = [];
    room.state.locations[0].ships = [];
    room = updateRoom(room, 30 * 1000);
    const planet = getLoc0(room.state).planets[0];
    expect(planet.health.current).toBeLessThan(planet.health.max);
  });

  it('bots shoot npcs and earn money', () => {
    let room = wasm.createRoom({ mode: 'PirateDefence', seed: 'bots' });
    room = updateRoom(room, 30 * 1000);
    expect(room.state.players[0].money).toBeGreaterThan(0);
  });

  it('bots follow the planet', () => {
    let room = wasm.createRoom({ mode: 'PirateDefence', seed: 'bots' });
    const firstBotPlayerId = room.bots[0].id;
    room = updateRoom(room, 50 * 1000);
    const newShipPos = findObjectPosition(
      getShipByPlayerId(room.state, firstBotPlayerId)
    );
    const planet = getLoc0(room.state).planets[0];
    const newPlanetPos = findObjectPosition(planet);
    const distance = Vector.fromIVector(newShipPos).euDistTo(
      Vector.fromIVector(newPlanetPos)
    );
    expect(distance).toBeLessThan(planet.spatial.radius * 2);
  });
});
