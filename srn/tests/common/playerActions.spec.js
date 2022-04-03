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

export const mockPlayerActionTransSystemJump = (
  toLocId,
  byPlayerId,
  shipId
) => ({
  tag: 'LongActionStart',
  player_id: byPlayerId,
  ship_id: shipId,
  long_action_start: {
    tag: 'TransSystemJump',
    to: toLocId,
  },
});

export const mockMineral = () => ({
  id: uuid.v4(),
  x: 0,
  y: 0,
  radius: 0.25,
  value: 100,
  rarity: 'Common',
  color: '#ff00ff',
});

export const mockPlayerActionMove = (type, shipId) => ({
  tag: type, // Gas | StopGas | Turn | StopTurn | Reverse
  ship_id: shipId,
});

export const mockPlayerActionNavigate = (shipId, to) => ({
  tag: 'Navigate',
  ship_id: shipId,
  target: to,
});

export const mockPlayerActionTractor = (shipId, target) => ({
  tag: 'Tractor',
  ship_id: shipId,
  target,
});

export const mockSelectDialogueOption = (playerId, dialogueId, optionId) => ({
  tag: 'SelectDialogueOption',
  dialogue_id: dialogueId,
  option_id: optionId,
  player_id: playerId,
});

export const mockCancelTradeAction = (playerId) => ({
  tag: 'CancelTrade',
  player_id: playerId,
});

export const mockInventoryActionMove = (playerId, itemId, index) => ({
  tag: 'Inventory',
  player_id: playerId,
  action: {
    tag: 'Move',
    item: itemId,
    index,
  },
});

export const mockSandboxActionAddContainer = (playerId) => ({
  tag: 'SandboxCommand',
  player_id: playerId,
  command: 'AddContainer',
});

export const mockActionDismissNotification = (playerId, notificationId) => ({
  tag: 'Notification',
  player_id: playerId,
  action: {
    tag: 'Dismiss',
    id: notificationId,
  },
});

export const mockPlayerActionDockNavigate = (shipId, to) => ({
  tag: 'DockNavigate',
  ship_id: shipId,
  target: to,
});

const createStateWithAShip = (mode = 'CargoRush') => {
  const state = wasm.seedWorld({
    seed: 'player actions',
    mode,
    gen_state_opts: genStateOpts({ system_count: 1 }),
  });
  const player = mockPlayer(uuid.v4());
  state.players.push(player);
  const ship = mockShip(uuid.v4());
  player.ship_id = ship.id;
  const loc = getLoc0(state);
  loc.ships.push(ship);
  // to not blow up due to being in the star
  ship.x = 100;
  ship.y = 100;
  return {
    state,
    player,
    ship,
    planet: getLoc0(state).planets[0],
  };
};

const dockToPlanet = (state, ship) => {
  let currState = state;
  const planet = getLoc0(currState).planets[0];
  ship.x = planet.x;
  ship.y = planet.y;
  currState.player_actions.push(
    mockPlayerActionDockNavigate(ship.id, planet.id)
  );
  currState = updateWorld(currState, 3000);
  return currState;
};

const findDialogueOptionId = (dialogue, keyword) =>
  dialogue.options.find(
    (o) => o.text.toLowerCase().indexOf(keyword.toLowerCase()) > -1
  )?.id;

const mockInventoryItem = (index = 0) => ({
  id: uuid.v4(),
  index,
  quantity: 10,
  value: 100,
  stackable: true,
  player_owned: true,
  item_type: 'CommonMineral',
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
        mockPlayerActionTransSystemJump(loc.id, player.id, shipId)
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
    it('can gas & stop & reverse', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      ship.x = 100.0;
      ship.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('Gas', ship.id));
      // movement inactivity is 500ms, so update has to be less than that
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeGreaterThan(100.0);
      ship.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('StopGas', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeCloseTo(100.0);
      ship.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('Reverse', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeLessThan(100.0);
    });

    it('can turn & stop', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      ship.x = 100.0;
      ship.y = 100.0;
      ship.rotation = Math.PI;
      state.player_actions.push(mockPlayerActionMove('TurnRight', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.rotation).toBeLessThan(Math.PI);
      const result_rotation = ship.rotation;
      state.player_actions.push(mockPlayerActionMove('StopTurn', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.rotation).toBeCloseTo(result_rotation);
      ship.rotation = Math.PI;
      state.player_actions.push(mockPlayerActionMove('TurnLeft', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.y).toBeGreaterThan(Math.PI);
    });
  });

  describe('navigation', () => {
    it('can navigate to a point', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      ship.x = 100.0;
      ship.y = 100.0;
      state.player_actions.push(
        mockPlayerActionNavigate(ship.id, {
          x: 110,
          y: 110,
        })
      );
      state = updateWorld(state, 1500);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.x).toBeCloseTo(110.0);
      expect(ship.y).toBeCloseTo(110.0);
    });

    it('can navigate and dock', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      const planet = getLoc0(state).planets[0];
      ship.x = planet.x + planet.radius + 20.0;
      ship.y = planet.y + planet.radius + 20.0;
      state.player_actions.push(
        mockPlayerActionDockNavigate(ship.id, planet.id)
      );
      state = updateWorld(state, 4000);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.docked_at).toEqual(planet.id);
    });
  });

  describe('tractoring', () => {
    it('can tractor a mineral', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      const mineral = mockMineral();
      getLoc0(state).minerals.push(mineral);
      mineral.x = 102.0;
      mineral.y = 102.0;
      ship.x = 100.0;
      ship.y = 100.0;
      state.player_actions.push(mockPlayerActionTractor(ship.id, mineral.id));
      state = updateWorld(state, 3000);
      ship = getShipByPlayerId(state, player.id);
      const invItem = ship.inventory[0];
      expect(invItem).toBeTruthy();
      expect(invItem.item_type).toEqual('CommonMineral');
    });
    it.todo('two ships can stall tractoring a mineral on equal distance');
    it.todo('two ships can win tractoring a mineral on unequal distance');
  });

  describe('dialogue actions', () => {
    it('can select dialogue options', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      state = dockToPlanet(state, ship, player);
      const myState = Object.entries(state.dialogue_states[player.id][1])[0];
      expect(myState[1]).toBeTruthy(); // we can't really compare anything here as those ids are random
      const dialogue = wasm.buildDialogueFromState(
        myState[0],
        myState[1],
        player.id,
        state
      );
      state.player_actions.push(
        mockSelectDialogueOption(
          player.id,
          dialogue.id,
          findDialogueOptionId(dialogue, 'undock')
        )
      );
      state = updateWorld(state, 1000);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.docked_at).toBeFalsy();
    });

    it('can initiate trade via dialogue and then close it', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship, planet } = createStateWithAShip();
      state = dockToPlanet(state, ship, player);
      const myDialogueState = Object.entries(
        state.dialogue_states[player.id][1]
      )[0];
      const dialogue = wasm.buildDialogueFromState(
        myDialogueState[0],
        myDialogueState[1],
        player.id,
        state
      );
      state.player_actions.push(
        mockSelectDialogueOption(
          player.id,
          dialogue.id,
          findDialogueOptionId(dialogue, 'marketplace')
        )
      );
      state = updateWorld(state, 1000);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.trading_with?.id).toEqual(planet.id);

      state.player_actions.push(mockCancelTradeAction(player.id));
      state = updateWorld(state, 1000);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.trading_with?.id).toBeFalsy();
    });
  });

  describe('inventory and trade actions', () => {
    it('can move items in the inventory', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      const item1 = mockInventoryItem();
      ship.inventory = [item1];
      state.player_actions.push(
        mockInventoryActionMove(player.id, item1.id, 1)
      );
      state = updateWorld(state, 1000);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.inventory[0].index).toEqual(1);
    });
    it.todo('can split items in the inventory');
    it.todo('can join items in the inventory');
    it.todo('can trade items with a planet');
  });

  describe('sandbox commands', () => {
    it('can add a container', () => {
      // eslint-disable-next-line prefer-const
      let { state, player } = createStateWithAShip('Sandbox');
      state.player_actions.push(mockSandboxActionAddContainer(player.id));
      state = updateWorld(state, 1000);
      expect(getLoc0(state).containers.length).toEqual(1);
    });
  });

  describe('notification actions', () => {
    it('can dismiss a notification', () => {
      // eslint-disable-next-line prefer-const
      let { state, player } = createStateWithAShip();
      const notId = uuid.v4();
      player.notifications.push({
        tag: 'Help',
        header: 'Test',
        text: {
          text: 'test',
          substituted: true,
          substitutions: [],
        },
        id: notId,
      });
      state.player_actions.push(
        mockActionDismissNotification(player.id, notId)
      );
      state = updateWorld(state, 1000);
      expect(
        state.players[0].notifications.filter((not) => not.id === notId)
      ).toHaveLength(0);
    });
  });
});
