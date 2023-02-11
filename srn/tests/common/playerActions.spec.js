import {
  createStateWithAShip,
  genStateOpts,
  getLoc0,
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
  updateWorld,
  wasm,
} from '../util';
import * as uuid from 'uuid';

export const mockNullPacketTagged = (act, happenedAtTicks = null) => [
  act,
  null,
  happenedAtTicks,
];

export const mockPlayerActionTransSystemJump = (toLocId, byPlayerId, shipId) =>
  mockNullPacketTagged({
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

export const mockPlayerActionMove = (type, shipId, happenedAtTicks = null) =>
  mockNullPacketTagged(
    {
      tag: type, // Gas | StopGas | Turn | StopTurn | Reverse
      ship_id: shipId,
    },
    happenedAtTicks
  );

export const mockPlayerActionNavigate = (shipId, to) =>
  mockNullPacketTagged({
    tag: 'Navigate',
    ship_id: shipId,
    target: to,
  });

export const mockPlayerActionTractor = (shipId, target) =>
  mockNullPacketTagged({
    tag: 'Tractor',
    ship_id: shipId,
    target,
  });

export const mockSelectDialogueOption = (playerId, dialogueId, optionId) =>
  mockNullPacketTagged({
    tag: 'SelectDialogueOption',
    dialogue_id: dialogueId,
    option_id: optionId,
    player_id: playerId,
  });

export const mockCancelTradeAction = (playerId) =>
  mockNullPacketTagged({
    tag: 'CancelTrade',
    player_id: playerId,
  });

export const mockInventoryActionMove = (playerId, itemId, index) =>
  mockNullPacketTagged({
    tag: 'Inventory',
    player_id: playerId,
    action: {
      tag: 'Move',
      item: itemId,
      index,
    },
  });

export const mockSandboxActionAddContainer = (playerId) =>
  mockNullPacketTagged({
    tag: 'SandboxCommand',
    player_id: playerId,
    command: {
      tag: 'AddContainer',
    },
  });

export const mockActionBuy = (playerId, planetId, type, amount) =>
  mockNullPacketTagged({
    tag: 'Trade',
    player_id: playerId,
    action: {
      planet_id: planetId,
      sells_to_planet: [],
      buys_from_planet: [[type, amount]],
    },
  });

export const mockActionDismissNotification = (playerId, notificationId) =>
  mockNullPacketTagged({
    tag: 'Notification',
    player_id: playerId,
    action: {
      tag: 'Dismiss',
      id: notificationId,
    },
  });

export const mockPlayerActionDockNavigate = (shipId, to) =>
  mockNullPacketTagged({
    tag: 'DockNavigate',
    ship_id: shipId,
    target: to,
  });

const dockToPlanet = (state, ship) => {
  let currState = state;
  const planet = getLoc0(currState).planets[0];
  ship.spatial.position.x = planet.spatial.position.x;
  ship.spatial.position.y = planet.spatial.position.y;
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
      room = updateRoom(room, 10000, 1000 * 1000);
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
      ship.spatial.position.x = 100.0;
      ship.spatial.position.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('Gas', ship.id));
      // movement inactivity is 500ms, so update has to be less than that
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.position.y).toBeGreaterThan(100.0);
      ship.spatial.position.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('StopGas', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.position.y).toBeCloseTo(100.0);
      ship.spatial.position.y = 100.0;
      state.player_actions.push(mockPlayerActionMove('Reverse', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.position.y).toBeLessThan(100.0);
    });

    it('can turn & stop', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      ship.spatial.position.x = 100.0;
      ship.spatial.position.y = 100.0;
      ship.spatial.rotation_rad = Math.PI;
      state.player_actions.push(mockPlayerActionMove('TurnRight', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.rotation_rad).toBeLessThan(Math.PI);
      const result_rotation = ship.spatial.rotation_rad;
      state.player_actions.push(mockPlayerActionMove('StopTurn', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.rotation_rad).toBeCloseTo(result_rotation);
      ship.spatial.rotation_rad = Math.PI;
      state.player_actions.push(mockPlayerActionMove('TurnLeft', ship.id));
      state = updateWorld(state, 250);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.rotation_rad).toBeGreaterThan(Math.PI);
      console.log(ship.spatial.rotation_rad, 'vs', Math.PI);
    });

    // TODO this is a very dumb version of lag compensation mechanism, that also will not consider
    // true order of actions, instead simply 'boosting' the movement actions.
    // 1. For the sake of shooting, this will be a problem, as it cannot do the counter-strike-like shooting in the past
    // 2. Even for client own actions, like move + turn this will be a problem, since it will not reapply them and mutual influence will be lost
    //
    // ideally, server should track the past state delayed by average halftrip,
    // and then when sending out actions received, send them adjusted with 2HT - UT time in the future,
    // where HT = half trip time, and UT - update time, both calculated statistically
    // TODO currently disabled due to bugs of sync
    xit('can apply a movement action in the past', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      const TIME_PASSED = 500;
      state = updateWorld(state, TIME_PASSED);
      ship.x = 100.0;
      ship.y = 100.0;
      const SIMULATE_PING = 250;
      state.player_actions.push(
        mockPlayerActionMove('Gas', ship.id, TIME_PASSED - SIMULATE_PING)
      );
      state = updateWorld(state, 250);
      // since 250 + 250 = 500, which is gas timeout delay, the ship should move to 500ms distance
      ship = getShipByPlayerId(state, player.id);
      const EPSILON = 0.01;
      expect(ship.y).toBeGreaterThan(
        100.0 + ship.movement_definition.move_speed * 1000 * 500 - EPSILON
      );
    });
  });

  describe('navigation', () => {
    it('can navigate to a point', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      ship.spatial.position.x = 100.0;
      ship.spatial.position.y = 100.0;
      state.player_actions.push(
        mockPlayerActionNavigate(ship.id, {
          x: 110,
          y: 110,
        })
      );
      state = updateWorld(state, 1500);
      ship = getShipByPlayerId(state, player.id);
      expect(ship.spatial.position.x).toBeCloseTo(110.0);
      expect(ship.spatial.position.y).toBeCloseTo(110.0);
    });

    it('can navigate and dock', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship } = createStateWithAShip();
      const planet = getLoc0(state).planets[0];
      ship.x = planet.spatial.position.x + planet.spatial.radius + 20.0;
      ship.y = planet.spatial.position.y + planet.spatial.radius + 20.0;
      state.player_actions.push(
        mockPlayerActionDockNavigate(ship.id, planet.id)
      );
      state = updateWorld(state, 8000);
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
      ship.spatial.position.x = 100.0;
      ship.spatial.position.y = 100.0;
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
    it('can trade items with a planet', () => {
      // eslint-disable-next-line prefer-const
      let { state, player, ship, planet } = createStateWithAShip();
      player.money = 5000;
      state = dockToPlanet(state, ship, player);
      ship = getShipByPlayerId(state, player.id);
      ship.trading_with = {
        tag: 'Planet',
        id: planet.id,
      };
      const mineral = state.market.wares[planet.id].find(
        (item) => item.item_type === 'CommonMineral'
      );
      expect(mineral).toBeTruthy();
      state.player_actions.push(
        mockActionBuy(player.id, planet.id, 'CommonMineral', 3)
      );
      state = updateWorld(state, 1000);
      ship = getShipByPlayerId(state, player.id);
      expect(
        ship.inventory.find((item) => item.item_type === 'CommonMineral')
          ?.quantity
      ).toEqual(3);
    });
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
