import { updateRoom, wasm, swapGlobals, exposePerfStats } from '../util';
import _ from 'lodash';
// pretty hacky solution of importing specially-cooked client code here, but workable.
// technically, it should be inside pkg, and code-generated (or provided together with it, rather)
// or even just be part of wasm itself, as it will eventually become to be fast enough,
// e.g. when I will want the full spatial indexes on the client
import {
  buildClientStateIndexes,
  findObjectPosition,
} from '../../client/src/ClientStateIndexing';

const getShipByPlayerId = (world, playerId) => {
  const indexes = buildClientStateIndexes(world);
  return indexes.shipByPlayerId.get(playerId);
};

describe('cargo rush bots behavior', () => {
  beforeAll(swapGlobals);
  it('can spawn some default bots', async () => {
    const room = wasm.createRoom({ mode: 'CargoRush' });
    const { state: world } = room;
    expect(world.players.length).toBeGreaterThan(0);
    expect(_.every(world.players, (p) => p.is_bot)).toBeTruthy();
  });

  it('bots ships start moving', async () => {
    let room = wasm.createRoom({ mode: 'CargoRush' });
    const firstBotPlayerId = room.bots[0].id;
    expect(firstBotPlayerId).toBeTruthy();
    const oldShipPos = findObjectPosition(
      getShipByPlayerId(room.state, firstBotPlayerId)
    );
    room = updateRoom(room, 1000);
    const newShipPos = findObjectPosition(
      getShipByPlayerId(room.state, firstBotPlayerId)
    );
    expect(oldShipPos.x).not.toBeCloseTo(newShipPos.x);
  });

  fit('bots earn some money', async () => {
    let room = wasm.createRoom({ mode: 'CargoRush' });
    room = updateRoom(room, 1000 * 60 * 2); // 120s should be enough for bots to complete a delivery
    const player = room.state.players[0];
    expect(player.money).toBeGreaterThan(0);
  });
});
