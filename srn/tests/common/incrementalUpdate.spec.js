import {
  genStateOpts,
  getLoc0,
  swapGlobals,
  updateWorld,
  updateWorldIncremental,
  wasm,
} from '../util';

describe('incremental updates', () => {
  beforeAll(swapGlobals);
  it('can update once-uploaded state by using tag', () => {
    const state = wasm.seedWorld({
      seed: 'incremental updates',
      mode: 'CargoRush',
      gen_state_opts: genStateOpts({ system_count: 1 }),
    });
    const updated = updateWorld(
      state,
      1000,
      undefined,
      undefined,
      'incremental'
    );
    const planetLoc = getLoc0(updated).planets[0].spatial.position;
    const updated2 = updateWorldIncremental('incremental', 1000);
    const planetLoc2 = getLoc0(updated2).planets[0].spatial.position;
    expect(planetLoc2).not.toEqual(planetLoc);
  });
});
