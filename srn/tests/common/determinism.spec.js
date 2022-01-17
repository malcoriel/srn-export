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

describe('update determinism', () => {
  beforeAll(swapGlobals);

  describe.each(['CargoRush'])('in %s mode', (mode) => {
    describe('state-gen', () => {
      it('can achieve double-run', () => {
        const stateA = wasm.seedWorld({ mode, seed: 'state gen' });
        const stateB = wasm.seedWorld({ mode, seed: 'state gen' });
        const stateC = wasm.seedWorld({ mode, seed: 'state gen1' });
        expect(stateA).toEqual(stateB);
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
