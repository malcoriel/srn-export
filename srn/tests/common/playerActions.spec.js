import {
  genStateOpts,
  getLoc0,
  getShipByPlayerId,
  mockPlayer,
  mockShip,
  swapGlobals,
  updateRoom,
  updateWorld,
  wasm,
} from '../util';
import * as uuid from 'uuid';
import _ from 'lodash';

export const mockPlayerActionTransSystemJump = (toLocId, byPlayerId) => ({
  tag: 'LongActionStart',
  player_id: byPlayerId,
  long_action_start: {
    tag: 'TransSystemJump',
    to: toLocId,
  },
});

export const mockPlayerActionMove = (type, byPlayerId) => ({
  tag: type, // Gas | StopGas | Turn | StopTurn | Reverse
  player_id: byPlayerId,
});

describe('player actions logic', () => {
  beforeAll(swapGlobals);

  describe('long actions', () => {
    it('can start long action TransSystemJump', async () => {
      let room = wasm.createRoom({
        seed: 'long actions',
        mode: 'CargoRush',
        gen_state_opts: genStateOpts({ system_count: 2 }),
      });
      const player = room.state.players[0];
      const playerShip = getShipByPlayerId(room.state, player.id);
      const shipId = playerShip.id;
      // a hack to prevent ship docking
      for (const planet of room.state.locations[0].planets) {
        planet.properties.push({ tag: 'UnlandablePlanet' });
      }
      const loc = room.state.locations[1];
      room.state.player_actions.push(
        mockPlayerActionTransSystemJump(loc.id, player.id)
      );
      room = updateRoom(room, 10000, 1000n * 1000n);
      const shipInLoc1 = room.state.locations[1].ships.find(
        (s) => s.id === shipId
      );
      expect(shipInLoc1).toBeTruthy();
    });
  });

  describe('combat', () => {
    it.todo('can shoot and destroy other ships');
  });

  describe('ship actions', () => {
    fit('can gas & stop & reverse', () => {
      let state = wasm.seedWorld({
        seed: 'ship actions',
        mode: 'CargoRush',
        gen_state_opts: genStateOpts({ system_count: 1 }),
      });
      const player = mockPlayer(uuid.v4());
      state.players.push(player);
      let ship = mockShip(uuid.v4());
      player.ship_id = ship.id;
      const loc = getLoc0(state);
      loc.ships.push(ship);
      ship.x = 100.0;
      ship.y = 100.0;
      ship.rotation = Math.PI; // ships are apparently turned to (0, -1) by default with 0.0
      state.player_actions.push(mockPlayerActionMove('Gas', player.id));
      // movement inactivity is 500ms, so update has to be less than that
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeGreaterThan(100.0);
      ship.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('StopGas', player.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeCloseTo(100.0);
      ship.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('Reverse', player.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeLessThan(100.0);
    });
    it.todo('can turn & stop');
    it.todo('can act in the past to prevent rollbacks');
    it.todo('does not allow to act too much in the past');
  });

  describe('tractoring', () => {
    it.todo('can tractor a container');
    it.todo('two ships can stall tractoring a container on equal distance');
    it.todo('two ships can win tractoring a container on unequal distance');
  });

  describe('dialogue actions', () => {
    it.todo('can initiate dialogues');
    it.todo('can select dialogue options');
  });

  describe('inventory and trade actions', () => {
    it.todo('can move items in the inventory');
    it.todo('can split items in the inventory');
    it.todo('can join items in the inventory');
    it.todo('can trade items with a planet');
  });

  describe('sandbox commands', () => {
    it.todo('can add a container');
  });

  describe('notification actions', () => {
    it.todo('can dismiss a notification');
  });
});
