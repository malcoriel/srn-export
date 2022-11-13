import Vector, { IVector } from './utils/Vector';
import * as _ from 'lodash';
import {
  findObjectById,
  getObjectPosition,
  setObjectPosition,
} from './ClientStateIndexing';

import {
  AABB,
  Action,
  GameState,
  getObjSpecId,
  ObjectSpecifier,
} from './world';

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
  diff: number;
};
type SyncerViolationTimeRollback = {
  tag: 'TimeRollback';
  from: number;
  to: number;
  diff: number;
};
type SyncerViolation = SyncerViolationObjectJump | SyncerViolationTimeRollback;

interface IStateSyncer {
  handleBatch: (events: StateSyncerEvent[]) => StateSyncerResult;
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

const MAX_ALLOWED_CORRECTION_JUMP_CONST = 50 / 1000 / 1000;

export class StateSyncer implements IStateSyncer {
  private readonly wasmUpdateWorld;

  private clientLagsAtTicks: number[] = [];

  constructor(deps: WasmDeps) {
    this.wasmUpdateWorld = deps.wasmUpdateWorld;
    this.desyncedCorrectState = null;
  }

  private state!: GameState;

  private trueState!: GameState;

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
        if (!this.state) {
          return this.onInit({ tag: 'init', state: event.state });
        }
        return this.onServerState(event);
      }
      case 'player action': {
        return this.onPlayerAction(event);
      }
      default:
        throw new Error(`bad case ${(event as any).tag}`);
    }
  };

  public handleBatch = (events: StateSyncerEvent[]): StateSyncerResult => {
    let result;
    for (const event of events) {
      result = this.handle(event);
    }
    // intentionally return only the last one
    return result || { tag: 'error', message: 'no handle result' };
  };

  private updateState(
    from: GameState,
    elapsedTicks: number,
    area: AABB
  ): GameState | null {
    const LONG_UPDATE_BAIL = 500 * 1000;
    if (elapsedTicks > LONG_UPDATE_BAIL) {
      console.warn(
        `too long update bail for ${Math.round(
          elapsedTicks / 1000
        )}ms (max ${LONG_UPDATE_BAIL})`
      );
      return from;
    }
    return this.wasmUpdateWorld(
      {
        state: from,
        limit_area: area,
        client: true,
      },
      elapsedTicks
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
    this.dropPendingActionsFullyCommittedOnServer(serverState);
    this.trueState = serverState;
    if (serverState.ticks < this.state.ticks) {
      // TODO rebase not reflected actions instead of plain update
      const diff = this.state.ticks - serverState.ticks;
      this.trueState =
        this.updateState(serverState, diff, visibleArea) || this.state;
    } else if (serverState.ticks >= this.state.ticks) {
      // TODO calculate proper value to extrapolate to instead, based on average client perf lag,
      // plus do the rebase not reflected actions
      this.trueState = serverState;
    }

    // this.state = this.trueState;

    return this.successCurrent();
  }

  private dropPendingActionsFullyCommittedOnServer(serverState: GameState) {
    const confirmedActionPacks = new Set(
      serverState.processed_player_actions.map((a: any) => a.packet_tag)
    );
    this.pendingActionPacks = this.pendingActionPacks.filter(
      (a) => !confirmedActionPacks.has(a.packet_tag)
    );
  }

  private rebaseCurrentStateUsingPendingActionPacks(
    serverState: GameState,
    visibleArea: AABB
  ): StateSyncerResult {
    const elapsedDiff = Math.abs(serverState.ticks - this.state.ticks);
    // console.log('rebase', elapsedDiff);
    // may not be exactly correct, since different actions happen in different moments in the past, and such reapplication
    // literally changes the outcome - however, it's unclear how to combine it with adjustMillis for now
    const alreadyExecutedTagsInState = new Set(
      serverState.processed_player_actions.map(({ packet_tag }) => packet_tag)
    );
    const actionsToRebase: [Action, null][] = (this.pendingActionPacks.reduce(
      (acc: any[], pack: PendingActionPack) => {
        if (!alreadyExecutedTagsInState.has(pack.packet_tag)) {
          return [...acc, ...pack.actions.map((a) => [a, pack.packet_tag])];
        }
        return acc;
      },
      []
    ) as unknown) as [Action, null][];

    serverState.player_actions.push(...actionsToRebase);
    const oldState = this.state;
    const rebasedState = this.updateState(
      serverState,
      elapsedDiff,
      visibleArea
    );
    if (!rebasedState) {
      return this.error(
        'rebase state failed, will fall back to desynced server state'
      );
    }
    // there is effectively 0 time passed - although, I can calculate time since last time update event of course
    const tmpViolations = this.checkViolations(oldState, rebasedState, 0);
    const objectJumpViolations = tmpViolations.filter(
      (v) => v.tag === 'ObjectJump'
    );
    if (objectJumpViolations.length > 0) {
      return this.successDesynced(rebasedState);
    }
    return this.successCurrent();
  }

  private onTimeUpdate(event: {
    tag: 'time update';
    elapsedTicks: number;
    visibleArea: AABB;
  }): StateSyncerResult {
    if (!this.state) {
      return this.successCurrent();
    }
    this.replaceCurrentState(
      this.updateState(this.state, event.elapsedTicks, event.visibleArea) ||
        this.state
    );
    // time has to pass for the server state as well
    this.trueState =
      this.updateState(this.trueState, event.elapsedTicks, event.visibleArea) ||
      this.trueState;
    this.violations = this.checkViolations(
      this.state,
      this.trueState,
      event.elapsedTicks
    );
    // without updating prevState, since it was already updated above
    this.state = this.applyMaxPossibleDesyncCorrection(
      this.violations.filter(
        (v) => v.tag === 'ObjectJump'
      ) as SyncerViolationObjectJump[],
      this.state,
      event.elapsedTicks
    );
    return this.successCurrent();
  }

  private flushNotYetAppliedPendingActionsIntoLocalState() {
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
  }

  private replaceCurrentState(newState: GameState) {
    this.prevState = _.cloneDeep(this.state);
    this.state = newState;
  }

  private onInit(event: { tag: 'init'; state: GameState }) {
    this.state = event.state;
    this.prevState = _.cloneDeep(this.state);
    this.trueState = _.cloneDeep(this.state);
    return this.successCurrent();
  }

  private successCurrent() {
    this.desyncedCorrectState = null;
    return { tag: 'success' as const, state: this.state };
  }

  private successDesynced(desyncedState: GameState, _reason?: string) {
    this.desyncedCorrectState = desyncedState;
    if (_reason) {
      // console.log('desynced', _reason);
    }
    return { tag: 'success desynced' as const, state: this.state };
  }

  // noinspection JSMethodCanBeStatic
  private error(message: string) {
    return { tag: 'error' as const, message };
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

  private MAX_ALLOWED_CORRECTION_JUMP_UNITS_PER_TICK = MAX_ALLOWED_CORRECTION_JUMP_CONST; // in units = 10 units/second is max allowed speed

  private CORRECTION_TELEPORT_BAIL_PER_TICK =
    MAX_ALLOWED_CORRECTION_JUMP_CONST * 20; // sometimes we need to teleport, e.g. in case of an actual teleport
  
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
        tag: 'TimeRollback' as const,
        from: prevState.ticks,
        to: newState.ticks,
        diff: prevState.ticks - newState.ticks,
      });
    }
    return res;
  }

  private log: any[] = [];

  flushLog(): any[] {
    try {
      return this.log;
    } finally {
      this.log = [];
    }
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
    return res as { spec: ObjectSpecifier; obj: any }[];
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
        diff: dist,
        // @ts-ignore
        diffX: newPos.x - oldPos.x,
        // @ts-ignore
        diffY: newPos.y - oldPos.y,
      };
    }
    return null;
  }

  private applyMaxPossibleDesyncCorrection(
    violations: SyncerViolationObjectJump[],
    currentState: GameState,
    elapsedTicks: number
  ) {
    const correctedState = _.cloneDeep(currentState);
    const maxShiftLen =
      elapsedTicks * this.MAX_ALLOWED_CORRECTION_JUMP_UNITS_PER_TICK;
    const correctedObjectIds = new Set();
    for (const violation of violations) {
      this.log.push(JSON.stringify(violation));
      const jumpDir = Vector.fromIVector(violation.to).subtract(
        Vector.fromIVector(violation.from)
      );
      let jumpCorrectionToOldPosBack: Vector;
      if (
        violation.diff / elapsedTicks >
        this.CORRECTION_TELEPORT_BAIL_PER_TICK
      ) {
        console.warn('teleport correction bail');
        jumpCorrectionToOldPosBack = jumpDir;
      } else {
        jumpCorrectionToOldPosBack = jumpDir
          .normalize()
          .scale(
            Math.min(
              maxShiftLen,
              jumpDir.length() -
                this.MAX_ALLOWED_JUMP_UNITS_PER_TICK * elapsedTicks
            )
          );
      }
      const objId = getObjSpecId(violation.obj)!;
      const newObj = findObjectById(correctedState, objId)?.object;
      const newObjectPos = Vector.fromIVector(getObjectPosition(newObj));
      this.log.push(jumpCorrectionToOldPosBack.toFix());
      const correctedPos = newObjectPos.add(jumpCorrectionToOldPosBack);
      setObjectPosition(newObj, correctedPos);
      correctedObjectIds.add(objId);
    }
    this.violations = this.violations.filter((v) => {
      return !(
        v.tag === 'ObjectJump' && correctedObjectIds.has(getObjSpecId(v.obj))
      );
    });
    if (correctedObjectIds.size > 0) {
      this.log.push(`corrected ${correctedObjectIds.size} violations`);
    }
    this.violations = this.checkViolations(
      currentState,
      correctedState,
      elapsedTicks
    );
    return correctedState;
  }

  private compensateClientLag(
    serverState: GameState,
    visibleArea: AABB,
    clientLagTicks: number
  ): StateSyncerResult {
    this.clientLagsAtTicks.push(this.state.ticks);
    // assume that if we lagged once for a certain value, then it should go forward to the same value
    return this.successDesynced(serverState);
  }

  private updateClientLagCounter(current_ticks: number, elapsedTicks: number) {
    const MAX_CLIENT_LAG_AGE_TICKS = 1000 * 1000 * 10;
    const MAX_ALLOWED_CLIENT_LAG_PER_PERIOD = 30; // 30 lags in last 10 seconds
    this.clientLagsAtTicks = this.clientLagsAtTicks.filter((point) => {
      return point >= current_ticks + elapsedTicks - MAX_CLIENT_LAG_AGE_TICKS;
    });
    if (this.clientLagsAtTicks.length > MAX_ALLOWED_CLIENT_LAG_PER_PERIOD) {
      console.warn(
        'client lags at',
        current_ticks,
        'x',
        this.clientLagsAtTicks.length
      );
    }
  }
}
