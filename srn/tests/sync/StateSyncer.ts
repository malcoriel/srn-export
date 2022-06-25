import Vector, { IVector } from '../../client/src/utils/Vector';
import * as _ from 'lodash';
import {
  findObjectById,
  getObjectPosition,
  setObjectPosition,
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
type StateSyncerDesyncedSuccess = { tag: 'success desynced'; state: GameState };
type StateSyncerFullDesyncedSuccess = {
  tag: 'full desynced success';
  state: GameState;
};
type StateSyncerError = { tag: 'error'; message: string };
type StateSyncerResult =
  | StateSyncerSuccess
  | StateSyncerError
  | StateSyncerDesyncedSuccess
  | StateSyncerFullDesyncedSuccess;

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

type StateSyncerEventServerState = {
  tag: 'server state';
  state: GameState;
  visibleArea: AABB;
};
type StateSyncerEvent =
  | { tag: 'init'; state: GameState; visibleArea: AABB }
  | { tag: 'time update'; elapsedTicks: number; visibleArea: AABB }
  | StateSyncerEventServerState
  | {
      tag: 'player action';
      actions: Action[];
      visibleArea: AABB;
      packetTag: string;
    };

type SyncerViolationObjectJump = {
  tag: 'ObjectJump';
  obj: ObjectSpecifier;
  from: IVector;
  to: IVector;
};
type SyncerViolationTimeRollback = {
  tag: 'TimeRollback';
  from: number;
  to: number;
  diff: number;
};
type SyncerViolation = SyncerViolationObjectJump | SyncerViolationTimeRollback;

interface IStateSyncer {
  handle(StateSyncerEvent: StateSyncerEvent): StateSyncerResult;
  getCurrentState(): GameState;
  getPrevState(): GameState;
  flushViolations(): SyncerViolation[];
  flushLog(): any[];
}

export interface WasmDeps {
  wasmUpdateWorld: any;
}

type PendingActionPack = {
  actions: Action[];
  packet_tag: string | null;
};

export class StateSyncer implements IStateSyncer {
  private readonly wasmUpdateWorld;

  constructor(deps: WasmDeps) {
    this.wasmUpdateWorld = deps.wasmUpdateWorld;
  }

  private state!: GameState;

  private prevState!: GameState;

  private desyncedCorrectState: GameState | null;

  public handle = (event: StateSyncerEvent): StateSyncerResult => {
    switch (event.tag) {
      case 'init': {
        return this.onInit(event);
      }
      case 'time update': {
        return this.onTimeUpdate(event);
      }
      case 'server state': {
        return this.onServerState(event);
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
    packetTag: string;
  }) {
    this.pendingActionPacks.push({
      actions: event.actions,
      packet_tag: event.packetTag,
    });
    return this.successCurrent();
  }

  private pendingActionPacks: PendingActionPack[] = [];

  private onServerState({
    state: serverState,
    visibleArea,
  }: StateSyncerEventServerState) {
    const confirmedActionPacks = new Set(
      serverState.processed_player_actions.map((a: any) => a.packet_tag)
    );
    this.pendingActionPacks = this.pendingActionPacks.filter(
      (a) => !confirmedActionPacks.has(a.packet_tag)
    );
    if (serverState.ticks < this.state.ticks) {
      return this.rebaseCurrentStateUsingPendingActionPacks(
        serverState,
        visibleArea
      );
    }
    throw new Error('TODO');
  }

  private rebaseCurrentStateUsingPendingActionPacks(
    serverState: GameState,
    visibleArea: AABB
  ): StateSyncerResult {
    const elapsedDiff = Math.abs(serverState.ticks - this.state.ticks);
    console.log({ elapsedDiff });
    // may not be exactly correct, since different actions happen in different moments in the past, and such reapplication
    // literally changes the outcome - however, it's unclear how to combine it with adjustMillis for now
    const alreadyExecutedTagsInState = new Set(
      serverState.processed_player_actions.map(({ packet_tag }) => packet_tag)
    );
    const actionsToRebase: [Action, null][] = this.pendingActionPacks.reduce(
      (acc, pack: PendingActionPack) => {
        if (!alreadyExecutedTagsInState.has(pack.packet_tag)) {
          return [...acc, ...pack.actions.map((a) => [a, pack.packet_tag])];
        }
        return acc;
      },
      []
    ) as [Action, null][];

    const rebasedActs = actionsToRebase;
    serverState.player_actions.push(...rebasedActs);
    const oldState = this.state;
    const rebasedState = this.updateState(
      serverState,
      elapsedDiff,
      visibleArea
    );
    // there is effectively 0 time passed - although, I can calculate time since last time update event of course
    const tmpViolations = this.checkViolations(oldState, rebasedState, 0);
    const objectJumpViolations = tmpViolations.filter(
      (v) => v.tag === 'ObjectJump'
    );
    if (objectJumpViolations.length > 0) {
      this.desyncedCorrectState = rebasedState;
      return this.successDesynced();
    }
    return this.successCurrent();
  }

  private onTimeUpdate(event: {
    tag: 'time update';
    elapsedTicks: number;
    visibleArea: AABB;
  }): StateSyncerResult {
    const oldState = this.state;
    const alreadyExecutedTagsInState = new Set(
      this.state.processed_player_actions.map(({ packet_tag }) => packet_tag)
    );
    if (this.pendingActionPacks.length > 0) {
      const flattenedActions = _.flatMap(
        this.pendingActionPacks,
        ({ actions, packet_tag }) => {
          if (alreadyExecutedTagsInState.has(packet_tag)) {
            return [];
          }
          return actions.map((a) => [a, packet_tag]);
        }
      ) as [Action, string][];
      this.state.player_actions.push(...flattenedActions);
    }
    const updatedState = this.updateState(
      this.desyncedCorrectState || this.state,
      event.elapsedTicks,
      event.visibleArea
    );
    this.violations = this.checkViolations(
      oldState,
      updatedState,
      event.elapsedTicks
    );
    if (this.violations.length === 0) {
      this.desyncedCorrectState = null;
      this.replaceCurrentState(updatedState);
      return this.successCurrent();
    }
    const correctedState = this.applyMaxPossibleDesyncCorrection(
      this.violations.filter(
        (v) => v.tag === 'ObjectJump'
      ) as SyncerViolationObjectJump[],
      oldState,
      updatedState,
      event.elapsedTicks
    );
    this.replaceCurrentState(correctedState);
    return this.successDesynced();
  }

  private replaceCurrentState(newState: GameState) {
    this.prevState = _.cloneDeep(this.state);
    this.state = newState;
  }

  private onInit(event: { tag: 'init'; state: GameState; visibleArea: AABB }) {
    this.state = event.state;
    this.prevState = _.cloneDeep(this.state);
    return this.successCurrent();
  }

  private successCurrent() {
    return { tag: 'success' as const, state: this.state };
  }

  private successDesynced() {
    return { tag: 'success desynced' as const, state: this.state };
  }

  getCurrentState() {
    return this.state;
  }

  getPrevState() {
    return this.prevState;
  }

  private violations: SyncerViolation[] = [];

  flushViolations(): SyncerViolation[] {
    const violations = this.violations;
    this.violations = [];
    return violations;
  }

  private MAX_ALLOWED_JUMP_UNITS_PER_TICK = 10 / 1000 / 1000; // in units = 10 units/second is max allowed speed

  private checkViolations(
    prevState: GameState,
    newState: GameState,
    elapsedTicks: number
  ): SyncerViolation[] {
    const res = [];
    const checkableObjects = this.enumerateCheckableObjects(newState);
    for (const { spec, obj } of checkableObjects) {
      const oldObj = this.findOldVersionOfObject(prevState, spec).object;
      if (oldObj) {
        const vio = this.checkPositionViolation(
          elapsedTicks,
          obj,
          oldObj,
          spec
        );
        if (vio) res.push(vio);
      }
    }
    if (prevState.ticks > newState.ticks) {
      res.push({
        tag: 'TimeRollback',
        from: prevState.ticks,
        to: newState.ticks,
        diff: prevState.ticks - newState.ticks,
      });
    }
    return res;
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
  ): SyncerViolation | null {
    const oldPos = Vector.fromIVector(getObjectPosition(oldObj));
    const newPos = Vector.fromIVector(getObjectPosition(newObj));
    const dist = oldPos.euDistTo(newPos);
    if (dist > elapsedTicks * this.MAX_ALLOWED_JUMP_UNITS_PER_TICK) {
      return {
        tag: 'ObjectJump',
        obj: spec,
        from: oldPos,
        to: newPos,
      };
    }
    return null;
  }

  private applyMaxPossibleDesyncCorrection(
    violations: SyncerViolationObjectJump[],
    fromCurrent: GameState,
    toCorrectDesynced: GameState,
    elapsedTicks: number
  ): GameState {
    const correctedState = _.cloneDeep(toCorrectDesynced);
    const maxShiftLen = elapsedTicks * this.MAX_ALLOWED_JUMP_UNITS_PER_TICK;
    const correctedObjectIds = new Set();
    for (const violation of violations) {
      const jumpDir = Vector.fromIVector(violation.to).subtract(
        Vector.fromIVector(violation.from)
      );
      const correctedJump = jumpDir.normalize().scale(maxShiftLen);
      const oldObj = findObjectById(fromCurrent, violation.obj.id).object;
      const oldObjectPos = Vector.fromIVector(getObjectPosition(oldObj));
      const newObj = findObjectById(correctedState, violation.obj.id).object;
      console.log({ correctedJump, oldObjectPos, violation });
      const correctedPos = oldObjectPos.add(correctedJump);
      setObjectPosition(newObj, correctedPos);
      correctedObjectIds.add(violation.obj.id);
    }
    this.violations = this.violations.filter((v) => {
      return !(v.tag === 'ObjectJump' && correctedObjectIds.has(v.obj.id));
    });
    this.log.push(`corrected ${correctedObjectIds.size} violations`);
    this.violations = this.checkViolations(
      fromCurrent,
      correctedState,
      elapsedTicks
    );
    return correctedState;
  }
}
