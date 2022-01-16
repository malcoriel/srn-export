import { getShipByPlayerId, swapGlobals, updateRoom, wasm } from '../util';

describe('autofocus behavior', () => {
  beforeAll(swapGlobals);
  it('in pirate defence, bot ships are not in hostile autofocus of each other', async () => {
    const room = updateRoom(wasm.createRoom({ mode: 'PirateDefence' }), 100);

    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const botShip2 = getShipByPlayerId(state, bot2);
    expect(botShip1.hostile_auto_focus?.id).not.toEqual(botShip2.id);
  });
});
