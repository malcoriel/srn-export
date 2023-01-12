import { wasm, swapGlobals } from '../util';

describe('planet movement', () => {
  beforeAll(swapGlobals);
  it('can generate phase table symmetrically', () => {
    const table1 = wasm.generatePhaseTable(60 * 1000 * 1000, 100.0);
    const table2 = wasm.generatePhaseTable(-60 * 1000 * 1000, 100.0);
    expect(table1.length).toEqual(table2.length);
    for (let i = 0; i < table1.length; i++) {
      expect(table1[i].x).toEqual(table2[i].x);
      expect(table1[i].y).toEqual(-table2[i].y);
    }
  });
});
