import {
  getLoc0,
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
  wasm,
} from '../util';
import _ from 'lodash';

const objSpecShip = (id) => ({ tag: 'Ship', id });
const objSpecPlanet = (id) => ({ tag: 'Planet', id });
const actorPlayer = (id) => ({ tag: 'Player', id });
const actorShip = (id) => ({ tag: 'Object', spec: objSpecShip(id) });
const actorPlanet = (id) => ({ tag: 'Object', spec: objSpecPlanet(id) });

const findAPirateShip = (loc) =>
  loc.ships.find((s) => {
    return _.some(s.properties, (p) => p.tag === 'PirateShip');
  });

const updatePirateDefenceUntilPiratesAppear = (
  room,
  intervalMs = 3000,
  timeoutMs = 30_000
) => {
  let currRoom = room;
  let timePassed = 0;
  while (timePassed <= timeoutMs) {
    timePassed += intervalMs;
    currRoom = updateRoom(currRoom, intervalMs);
    if (findAPirateShip(getLoc0(currRoom.state))) {
      return currRoom;
    }
  }
  throw new Error('Timeout updating room until pirates appear');
};

describe('pirate defence friend-or-foe behavior', () => {
  beforeAll(swapGlobals);
  it('considers bots friendly to each other', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const bot2 = room.bots[1].id;
    expect(
      wasm.friendOrFoe(state, actorPlayer(bot1), actorPlayer(bot2))
    ).toEqual('Friend');
  });

  it('considers bots friendly to themselves', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    expect(
      wasm.friendOrFoe(state, actorPlayer(bot1), actorPlayer(bot1))
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
      wasm.friendOrFoe(state, actorShip(botShip1.id), actorShip(botShip2.id))
    ).toEqual('Friend');
  });

  it('considers ships friendly to planet', async () => {
    const room = wasm.createRoom({ mode: 'PirateDefence' });
    const { state } = room;
    const bot1 = room.bots[0].id;
    const botShip1 = getShipByPlayerId(state, bot1);
    const planet = getLoc0(state).planets[0];
    expect(
      wasm.friendOrFoe(state, actorShip(botShip1.id), actorPlanet(planet.id))
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
      wasm.friendOrFoe(state, actorShip(botShip1.id), actorShip(pirate.id))
    ).toEqual('Foe');
  });
});
