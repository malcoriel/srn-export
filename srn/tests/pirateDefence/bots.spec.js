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
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state: world } = room;
    expect(world.players.length).toBeGreaterThan(0);
    expect(_.every(world.players, (p) => p.is_bot)).toBeTruthy();
  });

  it('npcs damage the planets after some time', async () => {
    let room = wasm.createRoom({ mode: 'PirateDefence' });
    room.bots = [];
    room = updateRoom(room, 30 * 1000);
    const planet = getLoc0(room.state).planets[0];
    expect(planet.health.current).toBeLessThan(planet.health.max);
  });

  it('bots shoot npcs and earn money', () => {
    let room = wasm.createRoom({ mode: 'PirateDefence' });
    room = updateRoom(room, 30 * 1000);
    expect(room.state.players[0].money).toBeGreaterThan(0);
  });
  fit('bots follow the planet', () => {
    let room = wasm.createRoom({ mode: 'PirateDefence' });
    const firstBotPlayerId = room.bots[0].id;
    const oldShipPos = findObjectPosition(
      getShipByPlayerId(room.state, firstBotPlayerId)
    );
    const oldPlanetPos = findObjectPosition(getLoc0(room.state).planets[0]);
    room = updateRoom(room, 50 * 1000);
    const newShipPos = findObjectPosition(
      getShipByPlayerId(room.state, firstBotPlayerId)
    );
    const newPlanetPos = findObjectPosition(getLoc0(room.state).planets[0]);
    const distance = Vector.fromIVector(newShipPos).euDistTo(
      Vector.fromIVector(newPlanetPos)
    );
    console.log({
      distance,
      oldShipPos,
      newShipPos,
      oldPlanetPos,
      newPlanetPos,
    });
    expect(distance).toBeLessThan(15);
  });
});
