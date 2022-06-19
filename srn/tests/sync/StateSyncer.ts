import Vector, { IVector } from '../../client/src/utils/Vector';
import {
  findObjectById,
  getObjectPosition,
} from '../../client/src/ClientStateIndexing';

import {
  AABB,
  GameState,
  // @ts-ignore
  ObjectSpecifier,
  // @ts-ignore
  Action,
} from '../../client/src/world';
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
  | { tag: 'time update'; elapsedTicks: number; visibleArea: AABB }
  | { tag: 'server state'; state: GameState; visibleArea: AABB }
  | {
      tag: 'player action';
      actions: Action[];
      visibleArea: AABB;
    };

type SyncerViolation = {
  tag: 'ObjectJump';
  obj: ObjectSpecifier;
  from: IVector;
  to: IVector;
};

interface IStateSyncer {
  handle(StateSyncerEvent: StateSyncerEvent): StateSyncerResult;
  observe(): GameState;
  flushViolations(): SyncerViolation[];
  flushLog(): any[];
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
      BigInt(elapsedTicks)
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

    const oldState = this.state;
    const elapsedTicks = this.state.update_every_ticks;
    this.state = this.updateState(this.state, elapsedTicks, event.visibleArea);
    this.checkViolations(oldState, this.state, elapsedTicks);
    return this.successCurrent();
  }

  private onServerUpdate() {
    return this.successCurrent();
  }

  private onTimeUpdate(event: {
    tag: 'time update';
    elapsedTicks: number;
    visibleArea: AABB;
  }) {
    const oldState = this.state;
    this.state = this.updateState(
      this.state,
      event.elapsedTicks,
      event.visibleArea
    );
    this.checkViolations(oldState, this.state, event.elapsedTicks);
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

  private violations: SyncerViolation[] = [];

  flushViolations(): SyncerViolation[] {
    const violations = this.violations;
    this.violations = [];
    return violations;
  }

  private MAX_ALLOWED_JUMP_UNITS_PER_TICK = 0.0005; // in units

  private checkViolations(
    prevState: GameState,
    newState: GameState,
    elapsedTicks: number
  ) {
    const checkableObjects = this.enumerateCheckableObjects(newState);
    for (const { spec, obj } of checkableObjects) {
      const oldObj = this.findOldVersionOfObject(prevState, spec).object;
      if (oldObj) {
        this.checkPositionViolation(elapsedTicks, obj, oldObj, spec);
      }
    }
  }

  private log: any[] = [];

  flushLog(): any[] {
    const log = this.log;
    this.log = [];
    return log;
  }

  private enumerateCheckableObjects(
    state: GameState
  ): { spec: ObjectSpecifier; obj: any }[] {
    const res = [];
    const ships = state.locations[0].ships.map((s) => ({
      spec: { tag: 'Ship', id: s.id },
      obj: s,
    }));
    res.push(...ships);
    return res;
  }

  private findOldVersionOfObject(
    prevState: GameState,
    spec: ObjectSpecifier
  ): any {
    if (spec.tag !== 'Unknown') {
      return findObjectById(prevState, spec.id);
    }
    return null;
  }

  private checkPositionViolation(
    elapsedTicks: number,
    newObj: any,
    oldObj: any,
    spec: ObjectSpecifier
  ) {
    const oldPos = Vector.fromIVector(getObjectPosition(oldObj));
    const newPos = Vector.fromIVector(getObjectPosition(newObj));
    const dist = oldPos.euDistTo(newPos);
    if (dist > elapsedTicks * this.MAX_ALLOWED_JUMP_UNITS_PER_TICK) {
      this.violations.push({
        tag: 'ObjectJump',
        obj: spec,
        from: oldPos,
        to: newPos,
      });
    }
  }
}
