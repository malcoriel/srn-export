import {
  loadWasm,
  packAndWriteReplay,
  updateRoom,
  wasm,
  writeReplay,
} from '../util';
import _ from 'lodash';

jest.setTimeout(50000);

function simulate() {
  const COUNT = 3;
  const STEP_MS = 1000;

  const states = [];
  const room = wasm.createRoom({
    mode: 'CargoRush',
    seed: 'replay stress',
  });
  let current = _.cloneDeep(room);

  for (let i = 0; i < COUNT; i++) {
    current = updateRoom(current, STEP_MS);
    states.push(_.cloneDeep(current.state));
  }
  return states;
}

describe('replay system', () => {
  beforeAll(loadWasm);
  xit('can survive stress test', async () => {
    const states = simulate();
    await packAndWriteReplay(states, 'stress-test');
  });

  it('can pack whole replay via wasm', async () => {
    const states = simulate();
    const replay = await wasm.packReplay(states, 'stress-test');
    await writeReplay(replay);
  });
});
