import {
  loadWasm,
  packAndWriteReplay,
  updateRoom,
  wasm,
  writeReplay,
  writeTmpJson,
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

  xit('can pack whole replay via wasm', async () => {
    const states = simulate();
    const replay = await wasm.packReplay(states, 'stress-test', false);
    await writeReplay(replay);
  });

  xit('can pack diff replay via wasm', async () => {
    const states = simulate();
    const replay = await wasm.packReplay(states, 'stress-test', true);
    await writeReplay(replay);
  });

  it('can compare replays', async () => {
    const states = simulate();
    const replayDiff = await wasm.packReplay(states, 'test', true);
    const replayRaw = await wasm.packReplay(states, 'test', false);
    const endStateDiff = replayDiff.current_state;
    const marksTick = replayRaw.marks_ticks[replayRaw.marks_ticks.length - 1];
    const endStateRaw = replayRaw.frames.get(marksTick).state;
    await writeTmpJson('diff', endStateDiff);
    await writeTmpJson('raw', endStateRaw);
    expect(endStateDiff).toEqual(endStateRaw);
  });
});
