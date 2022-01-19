import {
  getLoc0,
  getShipByPlayerId,
  swapGlobals,
  updateRoom,
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
        // expect(stateA).not.toEqual(stateC);
      });
    });

    describe('world update', () => {
      it.todo('can achieve double-run');
    });

    describe('room update', () => {
      it.todo('non-deterministic bots by default');
      it.todo('update with deterministic world but part-deterministic bots');
      it.todo('update with bots determinism if necessary');
    });
  });
});
