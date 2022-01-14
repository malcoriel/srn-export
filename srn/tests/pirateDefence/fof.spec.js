import { wasm, swapGlobals, getShipByPlayerId } from '../util';

describe('pirate defence friend-or-foe behavior', () => {
  beforeAll(swapGlobals);
  it('considers bots not hostile to each other', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const botShip2 = getShipByPlayerId(state, bot2);
    expect(wasm.friendOrFoeP2p(state, bot1, bot2)).toEqual('Friend');
  });
});
