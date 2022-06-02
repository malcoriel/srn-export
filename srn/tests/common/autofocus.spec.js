import {
  genStateOpts,
  getLoc0,
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
  wasm,
} from '../util';

describe('autofocus behavior', () => {
  beforeAll(swapGlobals);
  it('in pirate defence, bot ships are not in hostile autofocus of each other', async () => {
    const room = updateRoom(
      wasm.createRoom({ mode: 'PirateDefence', seed: 'autofocus' }),
      100
    );
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const botShip2 = getShipByPlayerId(state, bot2);
    expect(botShip1.hostile_auto_focus?.id).not.toEqual(botShip2.id);
  });

  it('in pirate defence, pirate npc ships are in hostile autofocus of bot ships', async () => {
    const room = updateRoom(
      wasm.createRoom({ mode: 'PirateDefence', seed: 'autofocus' }),
      100
    );

    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const botShip2 = getShipByPlayerId(state, bot2);
    expect(botShip1.hostile_auto_focus?.id).not.toEqual(botShip2.id);
  });

  it('can autofocus closest planet in cargo rush mode', async () => {
    let room = wasm.createRoom({
      mode: 'CargoRush',
      seed: 'autofocus',
      gen_state_opts: genStateOpts({ system_count: 1 }),
    });
    const firstBotId = room.bots[0].id;
    const botShipBeforeUpdate = getShipByPlayerId(room.state, firstBotId);
    const planet = getLoc0(room.state).planets[0];
    // this relies on the indexing to be keeping the reference to the original ship (and not copies)
    // so modifying indexed results actually modifies the ship
    botShipBeforeUpdate.x = planet.spatial.position.x; // teleport ship to planet
    botShipBeforeUpdate.y = planet.spatial.position.y;
    room = updateRoom(room, 100);
    const botShipAfterUpdate = getShipByPlayerId(room.state, firstBotId);
    expect(botShipAfterUpdate.auto_focus?.id).toEqual(planet.id);
  });
});
