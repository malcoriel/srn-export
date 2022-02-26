import { loadWasm, updateRoom, wasm, writeReplay, writeTmpJson } from '../util';
import _ from 'lodash';

jest.setTimeout(100000);

function simulate() {
  const COUNT = 20;
  const STEP_MS = 1000;

  const states = [];
  const room = wasm.createRoom({
    mode: 'CargoRush',
    seed: 'simulate replay',
  });
  let current = _.cloneDeep(room);
  states.push(_.cloneDeep(current.state));

  for (let i = 0; i < COUNT; i++) {
    current = updateRoom(current, STEP_MS);
    states.push(_.cloneDeep(current.state));
  }
  return states;
}

describe('replay system', () => {
  beforeAll(loadWasm);

  xit('can pack raw replay via wasm', async () => {
    const states = simulate();
    const replay = await wasm.packReplay(states, 'stress-test', false);
    await writeReplay(replay);
  });

  xit('can pack diff replay via wasm', async () => {
    const states = simulate();
    const replay = await wasm.packReplay(states, 'stress-test', true);
    await writeReplay(replay);
  });

  it('can validate diff replay against raw replay', async () => {
    const states = simulate();
    const replayDiff = await wasm.packReplay(states, 'test', true);
    const replayRaw = await wasm.packReplay(states, 'test', false);

    const lastIndex = replayRaw.marks_ticks.length - 1;
    const endStateRaw = replayRaw.frames[lastIndex].state;

    // await writeTmpJson('end-diff', endStateDiff);
    // await writeTmpJson('end-raw', endStateRaw);

    const endStateRestoredPrev = wasm.getDiffReplayStateAt(
      replayDiff,
      replayRaw.marks_ticks[lastIndex - 1]
    );
    await writeTmpJson('restored-prev', endStateRestoredPrev);
    await writeTmpJson(
      'patch-last',
      replayDiff.diffs[replayDiff.diffs.length - 1]
    );
    const endStateRestored = wasm.getDiffReplayStateAt(
      replayDiff,
      replayRaw.marks_ticks[lastIndex]
    );
    expect(endStateRestored).toEqual(endStateRaw);

    expect(replayRaw.initial_state.millis).toEqual(0);
    expect(replayRaw.marks_ticks[0]).toEqual(0);
    expect(replayRaw.marks_ticks[replayRaw.marks_ticks.length - 1]).toEqual(
      replayRaw.max_time_ms * 1000
    );
    expect(replayRaw.marks_ticks).toEqual(replayDiff.marks_ticks);
    expect(replayRaw.initial_state).toEqual(replayDiff.initial_state);
    expect(wasm.getDiffReplayStateAt(replayDiff, 0)).toEqual(
      replayDiff.initial_state
    );
  });

  it('can do sequential restoration', () => {
    const states = simulate();
    const replayDiff = wasm.packReplay(states, 'test', true);
    for (const tick of replayDiff.marks_ticks) {
      replayDiff.current_state = wasm.getDiffReplayStateAt(replayDiff, tick);
    }
  });
});
