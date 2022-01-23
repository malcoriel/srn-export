import {
  getLoc0,
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
  updateWorld,
  wasm,
} from '../util';

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
  return room;
};

describe('update determinism', () => {
  beforeAll(swapGlobals);

  describe.each(['CargoRush'])('in %s mode', (mode) => {
    describe('state-gen', () => {
      it('can achieve double-run', () => {
        const stateA = wasm.seedWorld({ mode, seed: 'state gen' });
        const stateB = wasm.seedWorld({ mode, seed: 'state gen' });
        const stateC = wasm.seedWorld({ mode, seed: 'state gen1' });
        expect(cementStateFields(stateA)).toEqual(cementStateFields(stateB));
        expect(cementStateFields(stateA)).not.toEqual(
          cementStateFields(stateC)
        );
      });
    });

    describe('normal world update in silence', () => {
      it('can achieve double-run', () => {
        const state = wasm.seedWorld({ mode, seed: 'world update' });
        const stateA = updateWorld(state, 10000);
        const stateB = updateWorld(state, 10000);
        const stateC = updateWorld(state, 10001);
        expect(cementStateFields(stateA)).toEqual(cementStateFields(stateB));
        expect(cementStateFields(stateA)).not.toEqual(
          cementStateFields(stateC)
        );
      });
      it('can achieve skip-step', () => {
        const state = wasm.seedWorld({ mode, seed: 'world update' });
        const stateA = updateWorld(state, 10000);
        const stateB = updateWorld(updateWorld(state, 5000), 5000);
        expect(cementStateFields(stateA)).toEqual(cementStateFields(stateB));
      });
    });

    describe('room update', () => {
      it('can make bots deterministic if necessary', () => {
        const room = wasm.createRoom({ mode, seed: 'world update' });
        const roomA = updateRoom(room, 10000);
        const roomB = updateRoom(room, 10000);
        const roomC = updateRoom(room, 10001);
        expect(cementRoomFields(roomA)).toEqual(cementRoomFields(roomB));
        expect(cementRoomFields(roomA)).not.toEqual(cementRoomFields(roomC));
      });
      it.todo('non-deterministic bots by default');
      it.todo('update with deterministic world but part-deterministic bots');
    });
  });
});
