import { AABB, GameState } from '../../client/src/world';
import { wasm } from '../util';
type StateSyncerSuccess = { tag: 'success'; state: GameState };
type StateSyncerDesyncedSuccess = { tag: 'desynced success'; state: GameState };
type StateSyncerError = { tag: 'error'; message: string };
type StateSyncerResult = StateSyncerSuccess | StateSyncerError;

type Assert = (condition: unknown, message?: string) => asserts condition;

export const invariant: Assert = (
  expr: any,
  message?: string
): asserts expr => {
  if (!expr) {
    throw new Error(message || 'invariant fail');
  }
};

export const invariantAndPull = <T>(expr: any, message?: string): T => {
  invariant(expr, message);
  return expr as T;
};

type StateSyncerEvent =
  | { tag: 'init'; state: GameState; visibleArea: AABB }
  | { tag: 'time update'; elapsedMs: number; visibleArea: AABB }
  | { tag: 'server state'; state: GameState; visibleArea: AABB }
  | {
      tag: 'player action';
      actions: GameState;
      visibleArea: AABB;
    };

interface IStateSyncer {
  handle(StateSyncerEvent: StateSyncerEvent): StateSyncerResult;
  observe(): GameState;
}

export class StateSyncer implements IStateSyncer {
  private state!: GameState;

  public handle = (event: StateSyncerEvent): StateSyncerResult => {
    switch (event.tag) {
      case 'init':
        this.state = event.state;
        return this.successCurrent();
      case 'time update':
        this.state = wasm.updateWorld(
          // @ts-ignore
          {
            state: this.state,
            limit_area: event.visibleArea,
            client: true,
          },
          BigInt(event.elapsedMs * 1000)
        );
        return this.successCurrent();
      case 'server state':
        return this.successCurrent();
      case 'player action':
        return this.successCurrent();
      default:
        throw new Error(`bad case ${(event as any).tag}`);
    }
  };

  private successCurrent() {
    return { tag: 'success' as const, state: this.state };
  }

  observe() {
    return this.state;
  }
}
