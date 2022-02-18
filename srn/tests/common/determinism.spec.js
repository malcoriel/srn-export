import {
  packAndWriteReplay,
  swapGlobals,
  updateRoom,
  updateWorld,
  wasm,
} from '../util';
import _ from 'lodash';

/*
*
* 'is deterministic in %i mode', mode) => {

    })
*
* */

// some fields are intentionally non-deterministic, since they are rather auxiliary (e.g. current date)
const cementStateFields = (state) => {
  state.start_time_ticks = 0;
  // there is some strange ordering bug with updating ships - some non-determinism defines the order of ops,
  // however the ops themselves are same
  for (const loc of state.locations) {
    loc.ships = _.sortBy(loc.ships, 'id');
  }
  return state;
};

const cementRoomFields = (room) => {
  room.state = cementStateFields(room.state);
  room.bots = [];
  return room;
};

describe('update determinism', () => {
  beforeAll(swapGlobals);

  describe.each(['CargoRush', 'Tutorial', 'Sandbox', 'PirateDefence'])(
    'basic updates in %s mode',
    (mode) => {
      describe('state-gen', () => {
        it('can achieve double-run', () => {
          const stateA = wasm.seedWorld({
            mode,
            seed: 'state gen',
          });
          const stateB = wasm.seedWorld({
            mode,
            seed: 'state gen',
          });
          const stateC = wasm.seedWorld({
            mode,
            seed: 'state gen1',
          });
          expect(cementStateFields(stateA)).toEqual(cementStateFields(stateB));
          expect(cementStateFields(stateA)).not.toEqual(
            cementStateFields(stateC)
          );
        });
      });

      describe('normal world update in silence', () => {
        it('can achieve double-run', () => {
          const state = wasm.seedWorld({
            mode,
            seed: 'world update',
          });
          const stateA = updateWorld(state, 10000);
          const stateB = updateWorld(state, 10000);
          const stateC = updateWorld(state, 10001);
          expect(cementStateFields(stateA)).toEqual(cementStateFields(stateB));
          expect(cementStateFields(stateA)).not.toEqual(
            cementStateFields(stateC)
          );
        });
        it('can achieve skip-step', () => {
          const state = wasm.seedWorld({
            mode,
            seed: 'world update',
          });
          const stateA = updateWorld(state, 10000);
          const stateB = updateWorld(updateWorld(state, 5000), 5000);
          expect(cementStateFields(stateA)).toEqual(cementStateFields(stateB));
        });
      });
    }
  );

  const serialUpdateAndCompare = async (room, updates, testName) => {
    let currentA = _.cloneDeep(room);
    const historyA = [_.cloneDeep(currentA.state)];
    let currentB = _.cloneDeep(room);
    const historyB = [_.cloneDeep(currentB.state)];
    let i = 0;
    for (const update of updates) {
      currentA = updateRoom(currentA, update);
      historyA.push(_.cloneDeep(currentA.state));
      currentB = updateRoom(currentB, update);
      historyB.push(_.cloneDeep(currentB.state));
      try {
        expect(
          cementRoomFields(currentA),
          `failed on serial compare #${i}`
        ).toEqual(cementRoomFields(currentB));
      } catch (e) {
        console.warn('failed on serial update:', e.message);
        await packAndWriteReplay(historyA, `${testName}-historyA`);
        await packAndWriteReplay(historyB, `${testName}-historyB`);
        throw e;
      }
      i++;
    }
  };

  describe.each(['PirateDefence'])('room updates in %s mode', (mode) => {
    describe('room update', () => {
      xit('can make bots deterministic if necessary', () => {
        const room = wasm.createRoom({
          mode,
          seed: 'world update',
          bots_seed: 'deterministic',
        });
        serialUpdateAndCompare(
          room,
          [10000, 250, 250, 250, 1000, 1000, 1000, 10000, 10000],
          'deterministic bots test'
        );
      });
      it('non-deterministic bots by default', () => {
        const room = wasm.createRoom({
          mode,
          seed: 'world update',
        });
        const roomA = updateRoom(room, 30000);
        const roomB = updateRoom(room, 30000);
        expect(cementRoomFields(roomA)).not.toEqual(cementRoomFields(roomB));
      });
    });
  });
});
