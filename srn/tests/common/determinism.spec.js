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
const cementFields = (state) => {
  state.start_time_ticks = 0;
  return state;
};

describe('update determinism', () => {
  beforeAll(swapGlobals);

  describe.each(['CargoRush'])('in %s mode', (mode) => {
    describe('state-gen', () => {
      it('can achieve double-run', () => {
        const stateA = wasm.seedWorld({ mode, seed: 'state gen' });
        const stateB = wasm.seedWorld({ mode, seed: 'state gen' });
        const stateC = wasm.seedWorld({ mode, seed: 'state gen1' });
        expect(cementFields(stateA)).toEqual(cementFields(stateB));
        expect(cementFields(stateA)).not.toEqual(cementFields(stateC));
      });
    });

    describe('normal world update in silence', () => {
      it('can achieve double-run', () => {
        const state = wasm.seedWorld({ mode, seed: 'world update' });
        const stateA = updateWorld(state, 10000);
        const stateB = updateWorld(state, 10000);
        const stateC = updateWorld(state, 10001);
        expect(cementFields(stateA)).toEqual(cementFields(stateB));
        expect(cementFields(stateA)).not.toEqual(cementFields(stateC));
      });
      xit('can achieve skip-step', () => {
        const state = wasm.seedWorld({ mode, seed: 'world update' });
        const stateA = updateWorld(state, 10000);
        const stateB = updateWorld(updateWorld(state, 5000), 5000);
        expect(cementFields(stateA)).toEqual(cementFields(stateB));
      });
    });

    describe('action-based world update', () => {
      it.todo('every player action handling is deterministic');
    });

    describe('room update', () => {
      it.todo('non-deterministic bots by default');
      it.todo('update with deterministic world but part-deterministic bots');
      it.todo('update with bots determinism if necessary');
    });
  });
});
