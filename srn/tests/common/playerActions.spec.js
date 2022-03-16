import {
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
  updateWorld,
  wasm,
} from '../util';

export const mockPlayerActionTransSystemJump = (toLocId, byPlayerId) => ({
  tag: 'LongActionStart',
  player_id: byPlayerId,
  long_action_start: {
    tag: 'TransSystemJump',
    to: toLocId,
  },
});

describe('player actions logic', () => {
  beforeAll(swapGlobals);

  describe('long actions', () => {
    it('can start long action TransSystemJump', async () => {
      let room = wasm.createRoom({
        seed: 'long actions',
        mode: 'CargoRush',
      });
      const player = room.state.players[0];
      const playerShip = getShipByPlayerId(room.state, player.id);
      const shipId = playerShip.id;
      console.log(room.state.locations.length);
      const loc = room.state.locations[1];

      room.state.player_actions.push(
        mockPlayerActionTransSystemJump(loc.id, player.id)
      );
      room = updateRoom(room, 20000);
      const shipInLoc1 = room.state.locations[1].ships.find(
        (s) => s.id === shipId
      );
      expect(shipInLoc1).toBeTruthy();
    });
  });

  describe('ship actions', () => {
    it.todo('can gas & stop');
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
