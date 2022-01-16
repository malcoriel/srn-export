import {
  fofActorPlanet,
  fofActorPlayer,
  fofActorShip,
  findAPirateShip,
  getLoc0,
  getShipByPlayerId,
  swapGlobals,
  updatePirateDefenceUntilPiratesAppear,
  wasm,
} from '../util';

describe('pirate defence friend-or-foe behavior', () => {
  beforeAll(swapGlobals);
  it('considers bots friendly to each other', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    expect(
      wasm.friendOrFoe(state, fofActorPlayer(bot1), fofActorPlayer(bot2))
    ).toEqual('Friend');
  });

  it('considers bots friendly to themselves', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    expect(
      wasm.friendOrFoe(state, fofActorPlayer(bot1), fofActorPlayer(bot1))
    ).toEqual('Friend');
  });

  it("considers bots' ships friendly to each other", async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const botShip2 = getShipByPlayerId(state, bot2);
    expect(
      wasm.friendOrFoe(
        state,
        fofActorShip(botShip1.id),
        fofActorShip(botShip2.id)
      )
    ).toEqual('Friend');
  });

  it('considers ships friendly to planet', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const planet = getLoc0(state).planets[0];
    expect(
      wasm.friendOrFoe(
        state,
        fofActorShip(botShip1.id),
        fofActorPlanet(planet.id)
      )
    ).toEqual('Friend');
  });

  it('considers bot players and ships hostile to npcs', async () => {
    let room = wasm.createRoom({ mode: 'PirateDefence' });
    room = updatePirateDefenceUntilPiratesAppear(room);
    const { state } = room;
    const pirate = findAPirateShip(getLoc0(state));
    expect(pirate).toBeTruthy();
    const bot1 = room.bots[0].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    expect(
      wasm.friendOrFoe(
        state,
        fofActorShip(botShip1.id),
        fofActorShip(pirate.id)
      )
    ).toEqual('Foe');
  });
});
