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
  getShipIdxByPlayerId,
} from '../util';

describe('pirate defence friend-or-foe behavior', () => {
  beforeAll(swapGlobals);
  it('considers bots friendly to each other', async () => {
    const room = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'fof',
    });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    expect(
      wasm.friendOrFoe(state, fofActorPlayer(bot1), fofActorPlayer(bot2), 0)
    ).toEqual('Friend');
  });

  it('considers bots friendly to themselves', async () => {
    const room = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'fof',
    });
    const { state } = room;
    const bot1 = room.bots[0].id;
    expect(
      wasm.friendOrFoe(state, fofActorPlayer(bot1), fofActorPlayer(bot1), 0)
    ).toEqual('Friend');
  });

  it("considers bots' ships friendly to each other", async () => {
    const room = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'fof',
    });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    const botShip1idx = getShipIdxByPlayerId(state, bot1);
    const botShip2idx = getShipIdxByPlayerId(state, bot2);
    expect(
      wasm.friendOrFoe(
        state,
        fofActorShip(botShip1idx),
        fofActorShip(botShip2idx),
        0
      )
    ).toEqual('Friend');
  });

  it('considers ships friendly to planet', async () => {
    const room = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'fof',
    });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const botShip1idx = getShipIdxByPlayerId(state, bot1);
    expect(
      wasm.friendOrFoe(state, fofActorShip(botShip1idx), fofActorPlanet(0), 0)
    ).toEqual('Friend');
  });

  it('considers bot players and ships hostile to npcs', async () => {
    let room = wasm.createRoom({
      mode: 'PirateDefence',
      seed: 'fof',
    });
    room = updatePirateDefenceUntilPiratesAppear(room);
    const { state } = room;
    const pirate = findAPirateShip(getLoc0(state));
    const pirateIdx = getLoc0(state).ships.indexOf(pirate);
    expect(pirate).toBeTruthy();
    const bot1 = room.bots[0].id;
    const botShip1idx = getShipIdxByPlayerId(state, bot1);
    expect(
      wasm.friendOrFoe(
        state,
        fofActorShip(botShip1idx),
        fofActorShip(pirateIdx),
        0
      )
    ).toEqual('Foe');
  });
});
