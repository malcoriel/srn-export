import { swapGlobals, updateRoom, updateWorld, wasm } from '../util';
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

  const serialUpdateAndCompare = (room, updates) => {
    let currentA = _.clone(room);
    let currentB = _.clone(room);
    let i = 0;
    for (const update of updates) {
      currentA = updateRoom(currentA, update);
      currentB = updateRoom(currentB, update);
      expect(
        cementRoomFields(currentA),
        `failed on serial compare #${i}`
      ).toEqual(cementRoomFields(currentB));
      i++;
    }
  };

  describe.each(['PirateDefence'])('room updates in %s mode', (mode) => {
    describe('room update', () => {
      fit('can make bots deterministic if necessary', () => {
        const room = wasm.createRoom({
          mode,
          seed: 'world update',
          bots_seed: 'deterministic',
        });
        serialUpdateAndCompare(room, [5000, 5000, 10000, 10000]);
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
