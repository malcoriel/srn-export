import { AABB, GameState } from '../../client/src/world';
import { Action } from '../../world/pkg/world';
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
      actions: Action[];
      visibleArea: AABB;
    };

interface IStateSyncer {
  handle(StateSyncerEvent: StateSyncerEvent): StateSyncerResult;
  observe(): GameState;
}

export interface WasmDeps {
  wasmUpdateWorld: any;
}

export class StateSyncer implements IStateSyncer {
  private readonly wasmUpdateWorld;

  constructor(deps: WasmDeps) {
    this.wasmUpdateWorld = deps.wasmUpdateWorld;
  }

  private state!: GameState;

  public handle = (event: StateSyncerEvent): StateSyncerResult => {
    switch (event.tag) {
      case 'init': {
        return this.onInit(event);
      }
      case 'time update': {
        return this.onTimeUpdate(event);
      }
      case 'server state': {
        return this.onServerUpdate();
      }
      case 'player action': {
        return this.onPlayerAction(event);
      }
      default:
        throw new Error(`bad case ${(event as any).tag}`);
    }
  };

  private updateState(from, elapsedTicks, area): GameState | null {
    return this.wasmUpdateWorld(
      {
        state: from,
        limit_area: area,
        client: true,
      },
      BigInt(elapsedTicks * 1000)
    );
  }

  private onPlayerAction(event: {
    tag: 'player action';
    actions: Action[];
    visibleArea: AABB;
  }) {
    this.state.player_actions.push(
      ...event.actions.map((a) => [a, null] as [Action, null])
    );

    this.state = this.updateState(
      this.state,
      this.state.update_every_ticks,
      event.visibleArea
    );
    return this.successCurrent();
  }

  private onServerUpdate() {
    return this.successCurrent();
  }

  private onTimeUpdate(event: {
    tag: 'time update';
    elapsedMs: number;
    visibleArea: AABB;
  }) {
    this.state = this.updateState(
      this.state,
      event.elapsedMs,
      event.visibleArea
    );
    return this.successCurrent();
  }

  private onInit(event: { tag: 'init'; state: GameState; visibleArea: AABB }) {
    this.state = event.state;
    return this.successCurrent();
  }

  private successCurrent() {
    return { tag: 'success' as const, state: this.state };
  }

  observe() {
    return this.state;
  }
}
