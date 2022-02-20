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
  const COUNT = 10;
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
    const replay = await wasm.packReplay(states, 'stress-test', false);
    await writeReplay(replay);
  });

  it('can pack diff replay via wasm', async () => {
    const states = simulate();
    const replay = await wasm.packReplay(states, 'stress-test', true);
    await writeReplay(replay);
  });

  xit('can compare replays', async () => {
    const states = simulate();
    const replayDiff = await wasm.packReplay(states, 'test', true);
    const replayRaw = await wasm.packReplay(states, 'test', false);
    const endStateDiff = replayDiff.current_state;
    const lastIndex = replayRaw.marks_ticks.length - 1;
    const endStateRaw = replayRaw.frames[lastIndex].state;
    await writeTmpJson('diff', endStateDiff);
    await writeTmpJson('raw', endStateRaw);
    const endStateRestored = wasm.getDiffReplayStateAt(
      replayDiff,
      replayRaw.marks_ticks[lastIndex]
    );
    await writeTmpJson('restored', endStateRestored);

    expect(endStateDiff).toEqual(endStateRaw);
    expect(endStateDiff).toEqual(endStateRestored);
  });
});
