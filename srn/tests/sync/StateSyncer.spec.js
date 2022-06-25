import { invariantAndPull, StateSyncer } from './StateSyncer';
import {
  getLoc0,
  getShipByPlayerId,
  mockPlayer,
  mockShip,
  swapGlobals,
  updateWorld,
  wasm,
} from '../util';
import * as uuid from 'uuid';
import _ from 'lodash';

const maxedAABB = {
  top_left: {
    x: -1000,
    y: -1000,
  },
  bottom_right: {
    x: 1000,
    y: 1000,
  },
};

const initSyncer = (seedWorldArgs) => {
  const initState = wasm.seedWorld(seedWorldArgs);
  const syncer = new StateSyncer({ wasmUpdateWorld: wasm.updateWorld });
  const result = syncer.handle({
    tag: 'init',
    state: initState,
  });
  const state = invariantAndPull(result.state, 'not success');
  return {
    initState,
    state,
    syncer,
  };
};

const patchAction = (action, state) => {
  const myShip = getShipByPlayerId(state, state.my_id);
  if (action.tag === 'Navigate') {
    if (action.ship_id === '$my_ship_id') {
      action.ship_id = myShip.id;
    }
  }
};

const toEvent = (key, value, prevState) => {
  if (key === 'A') {
    return {
      tag: 'player action',
      actions: value.actions,
      visibleArea: maxedAABB,
      packetTag: uuid.v4(),
    };
  }
  if (key === 'U') {
    return {
      tag: 'time update',
      elapsedTicks: 16000,
      visibleArea: maxedAABB,
    };
  }
  if (key.startsWith('Ux')) {
    const counter = key.match(/^Ux(\d+)/)[1];
    return _.times(counter, () => ({
      tag: 'time update',
      elapsedTicks: 16000,
      visibleArea: maxedAABB,
    }));
  }
  if (key === 'SbA') {
    return {
      tag: 'server state',
      state: value.serverStateChanger(prevState),
      visibleArea: maxedAABB,
    };
  }
  throw new Error(`unsupported event key ${key}`);
};

const toResult = ({ tag, stateChecker }) => {
  if (tag === 'S') {
    return {
      tag: 'success',
      stateChecker,
    };
  }
  if (tag === 'SD') {
    return {
      tag: 'success desynced',
      stateChecker,
    };
  }
  throw new Error(`unsupported result key ${tag}`);
};

const checkViolations = (syncer, showLog) => {
  const log = syncer.flushLog();
  if (showLog) {
    for (const entry of log) {
      console.log(entry);
    }
  }
  const violations = syncer.flushViolations();
  expect(violations).toEqual([]);
};

describe('state syncer', () => {
  beforeAll(swapGlobals);

  it('init returns same state', async () => {
    const { initState, state } = initSyncer({
      mode: 'CargoRush',
      seed: '123',
    });
    expect(state).toEqual(initState);
  });

  it('update world with big area produces same result as just client update world', () => {
    const { syncer, initState } = initSyncer({
      mode: 'CargoRush',
      seed: '123',
    });
    const syncerState = invariantAndPull(
      syncer.handle({
        tag: 'time update',
        elapsedTicks: 16000,
        visibleArea: maxedAABB,
      }).state
    );
    const updateState = updateWorld(initState, 16, false);
    expect(syncerState).toEqual(updateState);
  });

  /*
   * A - player action
   * S - server update
   * U - time update
   *
   * (A, S, U*) - server before time (potential erase or rollback)
   * * (SwA) - server has managed to process action before update
   * * (SaA) - server sent a state after action but before processing
   * * (SbA) - some server update that was already in flight, got received and it is before action
   * (A, U*, S) - server after time (still potential erase or rollback)
   * * (SwA) - server has managed to process action before update
   * * (SaA) - server sent a state after action but before processing
   * * (SbA) - some server update that was already in flight, got received and it is before action
   * (U, S, A) - desync without action (potential rollback)
   * * (SbU) - server state before update was in-flight
   * * (SaU) - server managed to send state after client update (likely client is lagging a lot)
   * * disregarded:
   * * (U, A, S) -  equivalent to ASU
   * * (S, A, U) - equivalent to AUS
   * * (S, U, A) - equivalent to ASU or AUS
   * */

  // invariants:
  // 1. acceptable desync or client lag < 200ms => no desynced results, assuming 0% packet loss
  // 2. no update can produce ticks that are lower than previous ticks, even desynced
  // when no desynced invariants:
  // 3. nothing visible jumps for more than MAX_JUMP_PER_MS after any kind of update
  // 4. no commands get lost or rolled back after any update
  // desynced invariants:
  // 5. objects jump immediately, without any delay, to their correct state

  const squareMovementInit = (state) => {
    state.my_id = uuid.v4();
    const player = mockPlayer(state.my_id);
    state.players.push(player);
    const ship = mockShip(uuid.v4());
    player.ship_id = ship.id;
    const loc = getLoc0(state);
    loc.ships.push(ship);
    ship.x = 100;
    ship.y = 100;
    return ship;
  };

  const coordsAreBigger = (state, prevState) => {
    const ship = getShipByPlayerId(state, state.my_id);
    const oldShip = getShipByPlayerId(prevState, state.my_id);
    expect(ship.x).toBeGreaterThan(oldShip.x);
    expect(ship.y).toBeGreaterThan(oldShip.y);
  };
  it('can apply actions', () => {
    const { syncer, initState } = initSyncer({
      mode: 'Sandbox',
      seed: '123',
    });
    const ship = squareMovementInit(initState);
    const navigateBottom = { x: 125, y: 125 };
    const res = syncer.handle({
      tag: 'player action',
      actions: [{ tag: 'Navigate', ship_id: ship.id, target: navigateBottom }],
      visibleArea: maxedAABB,
    });
    expect(res.tag).toBe('success');
    const newShip = getShipByPlayerId(res.state, res.state.my_id);
    expect(newShip.navigate_target).toEqual(navigateBottom);
  });
});
