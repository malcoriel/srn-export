import {
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
  wasm,
  findObjectPosition,
  genStateOpts,
} from '../util';
import _ from 'lodash';

describe('cargo rush bots behavior', () => {
  beforeAll(swapGlobals);
  it('can spawn some default bots', async () => {
    const room = wasm.createRoom({
      mode: 'CargoRush',
      seed: 'bots',
      gen_state_opts: genStateOpts({ system_count: 1 }),
    });
    const { state: world } = room;
    expect(world.players.length).toBeGreaterThan(0);
    expect(_.every(world.players, (p) => p.is_bot)).toBeTruthy();
  });

  it('bots ships start moving', async () => {
    let room = wasm.createRoom({
      mode: 'CargoRush',
      seed: 'bots',
      gen_state_opts: genStateOpts({ system_count: 1 }),
    });
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

  it('bots earn some money', async () => {
    let room = wasm.createRoom({
      mode: 'CargoRush',
      seed: 'bots',
      gen_state_opts: genStateOpts({ system_count: 1 }),
    });
    room = updateRoom(room, 1000 * 60 * 3);
    const player = room.state.players[0];
    expect(player.money).toBeGreaterThan(0);
  });
});
