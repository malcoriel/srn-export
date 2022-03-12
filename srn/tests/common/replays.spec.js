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

  describe('can validate diff replay against raw replay', () => {
    const test = async (getDiff, name, states, replayDiff) => {
      const replayRaw = wasm.packReplay(states, `${name}-test`, false);

      const lastIndex = replayRaw.marks_ticks.length - 1;
      const endStateRaw = replayRaw.frames[lastIndex].state;

      const endStateRestoredPrev = getDiff(
        replayRaw.marks_ticks[lastIndex - 1]
      );
      await writeTmpJson(`${name}-restored-prev`, endStateRestoredPrev);
      await writeTmpJson(
        `${name}-patch-last`,
        replayDiff.diffs[replayDiff.diffs.length - 1]
      );
      const endStateRestored = getDiff(replayRaw.marks_ticks[lastIndex]);
      expect(endStateRestored).toEqual(endStateRaw);

      expect(replayRaw.initial_state.millis).toEqual(0);
      expect(replayRaw.marks_ticks[0]).toEqual(0);
      expect(replayRaw.marks_ticks[replayRaw.marks_ticks.length - 1]).toEqual(
        replayRaw.max_time_ms * 1000
      );
      expect(replayRaw.marks_ticks).toEqual(replayDiff.marks_ticks);
      expect(replayRaw.initial_state).toEqual(replayDiff.initial_state);
      expect(getDiff(0)).toEqual(replayDiff.initial_state);
    };

    it('works with non-preloaded replay', async () => {
      const name = 'non-preloaded';
      const states = simulate();
      const replayDiff = wasm.packReplay(states, `${name}-test`, true);
      await test(
        (ticks) => wasm.getDiffReplayStateAt(replayDiff, ticks),
        name,
        states,
        replayDiff
      );
    });
    it('works with preloaded replay', async () => {
      const name = 'non-preloaded';
      const states = simulate();
      const replayDiff = wasm.packReplay(states, `${name}-test`, true);
      wasm.loadReplay(replayDiff);
      await test(
        (ticks) => wasm.getPreloadedDiffReplayStateAt(ticks),
        name,
        states,
        replayDiff
      );
    });
  });

  it('can do sequential restoration', () => {
    const states = simulate();
    const replayDiff = wasm.packReplay(states, 'test', true);
    wasm.loadReplay(replayDiff);
    for (const tick of replayDiff.marks_ticks) {
      replayDiff.current_state = wasm.getPreloadedDiffReplayStateAt(tick);
    }
    // validate that backwards search doesn't break it
    replayDiff.current_state = wasm.getPreloadedDiffReplayStateAt(0);
  });

  fit("can restore interpolated state and it's equal to state interpolation", () => {
    const states = simulate();
    const replayDiff = wasm.packReplay(states, 'test', true);
    wasm.loadReplay(replayDiff);

    for (const [idxA, idxB, value] of [
      [0, 1, 0.5],
      [10, 11, 0.5],
      [10, 11, 0.3],
    ]) {
      console.log({ idxA, idxB, value });
      const prev = replayDiff.marks_ticks[idxA];
      const next = replayDiff.marks_ticks[idxB];
      const interpolatedRestored = wasm.getPreloadedDiffReplayStateAtInterpolated(
        prev,
        next,
        value
      );
      const interpolated = wasm.interpolateStates(
        states[idxA],
        states[idxB],
        value
      );
      expect(interpolatedRestored).toEqual(interpolated);
    }
  });

  it.todo('can do non-optimized interpolate restoration');
});
