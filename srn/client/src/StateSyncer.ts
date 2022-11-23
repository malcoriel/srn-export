import Vector, { IVector } from './utils/Vector';
import {
  findMyShip,
  findObjectById,
  getObjectPosition,
  getObjectRotation,
  setObjectPosition,
  setObjectRotation,
} from './ClientStateIndexing';

import {
  AABB,
  Action,
  GameState,
  getObjSpecId,
  ObjectSpecifier,
} from './world';
import { Measure, Perf } from './HtmlLayers/Perf';

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
  flushViolations(): SyncerViolation[];
  flushLog(): any[];
}

export interface WasmDeps {
  wasmUpdateWorld: any;
}

type PendingActionPack = {
  actions: Action[];
  packet_tag: string | null;
  happened_at_ticks: number;
};

const MAX_ALLOWED_CORRECTION_JUMP_CONST = 15 / 1000 / 1000;
// max 'too fast client' desync value, to skip too eager client frame. Since 1 update is roughly 16ms, then we must allow 1 frame ahead, but not 2
const MAX_ALLOWED_CLIENT_AHEAD_TICKS = 17 * 1000;
// if client is too much ahead, complete frame skipping may be notices, but what if we slow down the frame by factor X?
const CLIENT_AHEAD_DILATION_FACTOR = 0.5;

// due to frame skipping and network desync artifacts, to make UX better I suppress the displayed state changes when it's lower than this value. Essentially, lying about true state
const MAX_ALLOWED_VISUAL_DESYNC_UNITS = 0.3;

export class StateSyncer implements IStateSyncer {
  private readonly wasmUpdateWorld;

  private eventCounter = 0;

  constructor(deps: WasmDeps) {
    this.wasmUpdateWorld = deps.wasmUpdateWorld;
    this.desyncedCorrectState = null;
  }

  private state!: GameState;

  private trueState!: GameState;

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
    area: AABB,
    context: string
  ): GameState | null {
    const LONG_UPDATE_BAIL = 500 * 1000;
    if (elapsedTicks > LONG_UPDATE_BAIL) {
      const clientAheadTicks =
        this.state.ticks + elapsedTicks - this.trueState.ticks;
      console.warn(
        `too long update bail for ${Math.round(
          elapsedTicks / 1000
        )}ms (max ${Math.round(
          LONG_UPDATE_BAIL / 1000
        )}ms) in ${context}, client ahead by ${Math.round(
          clientAheadTicks / 1000
        )}ms`
      );
      return from;
    }
    // if (this.pendingActionPacks.length > 0) {
    //   this.log.push(`Pending actions: ${this.pendingActionPacks.length}`);
    // }

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
    if (!this.state) {
      return this.error('no state');
    }
    this.pendingActionPacks.push({
      actions: event.actions,
      packet_tag: event.packetTag,
      happened_at_ticks: this.state.ticks,
    });
    this.state.player_actions.push(
      ...event.actions.map(
        (a) =>
          [a, event.packetTag, this.state.ticks] as [
            Action,
            string | null,
            number | null
          ]
      )
    );
    this.trueState = this.state; // invalidate whatever we had previously during correction, as client view has to win immediately, then get compensated
    return this.successCurrent();
  }

  private pendingActionPacks: PendingActionPack[] = [];

  private onServerState({
    state: serverState,
    visibleArea,
  }: StateSyncerEventServerState) {
    this.dropCommitedAndOutdatedPendingActions(serverState);
    this.trueState = serverState;
    this.eventCounter += 1;
    this.eventCounter = Math.max(10);
    if (serverState.ticks < this.state.ticks) {
      // TODO to properly avoid rollbacks from this one, server needs to use the 3rd player action argument of 'when it happened', to apply action in the past
      // or do the true server-in-the-past schema
      const diff = this.state.ticks - serverState.ticks;
      const rebasedState = this.rebaseStateUsingCurrentActions(
        serverState,
        diff,
        visibleArea,
        'onServerState'
      );
      this.trueState = rebasedState || serverState;
      Perf.markArtificialTiming(`ServerBehind ${this.eventCounter}`);
    } else if (serverState.ticks >= this.state.ticks) {
      // TODO maybe calculate proper value to extrapolate to instead, based on average client perf lag,
      // plus do the rebase not reflected actions?
      this.trueState = serverState;
      Perf.markArtificialTiming(`ServerAhead ${this.eventCounter}`);
    }

    // this.state = this.trueState;

    return this.successCurrent();
  }

  private dropCommitedAndOutdatedPendingActions(serverState: GameState) {
    const confirmedActionPacks = new Set(
      serverState.processed_player_actions.map((a: any) => a.packet_tag)
    );
    // this.log.push(
    //   `pending: ${this.pendingActionPacks.map((a) => a.packet_tag).join(',')}`
    // );
    // this.log.push(
    //   `processed: ${serverState.processed_player_actions
    //     .map((a) => a.packet_tag)
    //     .join(',')}`
    // );
    this.pendingActionPacks = this.pendingActionPacks.filter(
      (a) => !confirmedActionPacks.has(a.packet_tag)
    );
  }

  private rebaseStateUsingCurrentActions(
    state: GameState,
    elapsedTicks: number,
    visibleArea: AABB,
    context: string
  ): GameState | null {
    const alreadyExecutedTagsInState = new Set(
      state.processed_player_actions.map(({ packet_tag }) => packet_tag)
    );
    const actionsToRebase: [
      Action,
      null,
      number
    ][] = (this.pendingActionPacks.reduce(
      (acc: any[], pack: PendingActionPack) => {
        const isInTimeFrame =
          pack.happened_at_ticks <= state.ticks + elapsedTicks;
        if (!alreadyExecutedTagsInState.has(pack.packet_tag) && isInTimeFrame) {
          return [
            ...acc,
            ...pack.actions.map((a) => [
              a,
              pack.packet_tag,
              pack.happened_at_ticks,
            ]),
          ];
        }
        return acc;
      },
      []
    ) as unknown) as [Action, null, number][];

    state.player_actions.push(...actionsToRebase);
    return this.updateState(
      state,
      elapsedTicks,
      visibleArea,
      `${context} rebase`
    );
  }

  private onTimeUpdate(event: {
    tag: 'time update';
    elapsedTicks: number;
    visibleArea: AABB;
  }): StateSyncerResult {
    if (!this.state) {
      return this.successCurrent();
    }
    // sometimes there is no need to update state, e.g. right after the player action (optimistic updates)
    // or if there is no desync (everything got compensated)
    const weAreDesynced = this.trueState !== this.state;

    const clientAheadTicks =
      this.state.ticks + event.elapsedTicks - this.trueState.ticks;
    let targetDiff = event.elapsedTicks;
    if (clientAheadTicks > MAX_ALLOWED_CLIENT_AHEAD_TICKS) {
      // console.warn(
      //   `frame dilation due to client too much ahead, ${clientAheadTicks} > ${MAX_ALLOWED_CLIENT_AHEAD_TICKS} ticks`
      // );
      targetDiff *= CLIENT_AHEAD_DILATION_FACTOR;
    }
    Perf.usingMeasure(Measure.SyncedStateUpdate, () => {
      this.replaceCurrentState(
        this.updateState(
          this.state,
          targetDiff,
          event.visibleArea,
          'onTimeUpdate current'
        ) || this.state
      );
    });

    if (weAreDesynced) {
      Perf.usingMeasure(Measure.DesyncedStateUpdate, () => {
        console.log('desync at', performance.now());
        // time has to pass for the server state as well
        this.trueState =
          this.rebaseStateUsingCurrentActions(
            this.trueState,
            event.elapsedTicks,
            event.visibleArea,
            'onTimeUpdate true'
          ) || this.trueState;
        this.violations = this.checkViolations(
          this.state,
          this.trueState,
          event.elapsedTicks
        );
        this.state = this.applyMaxPossibleDesyncCorrection(
          this.violations.filter(
            (v) => v.tag === 'ObjectJump'
          ) as SyncerViolationObjectJump[],
          this.state,
          event.elapsedTicks
        );
        this.overrideRotationsInstantly(this.state, this.trueState);
      });
    } else {
      this.trueState = this.state;
    }
    return this.successCurrent();
  }

  private replaceCurrentState(newState: GameState) {
    // this.prevState = _.cloneDeep(this.state);
    this.state = newState;
  }

  private onInit(event: { tag: 'init'; state: GameState }) {
    this.state = event.state;
    this.trueState = this.state;
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

  private violations: SyncerViolation[] = [];

  flushViolations(): SyncerViolation[] {
    const violations = this.violations;
    this.violations = [];
    return violations;
  }

  private MAX_ALLOWED_JUMP_DESYNC_UNITS_PER_TICK = 10 / 1000 / 1000; // in units = 10 units/second is max allowed speed

  private MAX_ALLOWED_CORRECTION_JUMP_UNITS_PER_TICK = MAX_ALLOWED_CORRECTION_JUMP_CONST; // in units = 10 units/second is max allowed speed

  private CORRECTION_TELEPORT_BAIL_PER_TICK =
    MAX_ALLOWED_CORRECTION_JUMP_CONST * 30; // sometimes we need to teleport, e.g. in case of an actual teleport

  private checkViolations(
    prevState: GameState,
    newState: GameState,
    elapsedTicks: number
  ): SyncerViolation[] {
    const res = [];
    const checkableObjects = this.enumerateCheckableObjects(newState);
    for (const { spec, obj } of checkableObjects) {
      const oldObjInstance = this.findOldVersionOfObject(prevState, spec);
      if (oldObjInstance) {
        const oldObj = oldObjInstance.object;
        if (oldObj) {
          const posVio = this.checkPositionViolation(
            elapsedTicks,
            obj,
            oldObj,
            spec
          );
          if (posVio) res.push(posVio);
        }
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
    if (
      dist > elapsedTicks * this.MAX_ALLOWED_JUMP_DESYNC_UNITS_PER_TICK &&
      dist > MAX_ALLOWED_VISUAL_DESYNC_UNITS
    ) {
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
    const myShipId = findMyShip(currentState)?.id;
    const maxShiftLen =
      elapsedTicks * this.MAX_ALLOWED_CORRECTION_JUMP_UNITS_PER_TICK;
    const correctedObjectIds = new Set();
    for (const violation of violations) {
      const jumpDir = Vector.fromIVector(violation.to).subtract(
        Vector.fromIVector(violation.from)
      );
      let jumpCorrectionToOldPosBack: Vector;
      if (
        violation.diff / elapsedTicks >
        this.CORRECTION_TELEPORT_BAIL_PER_TICK
      ) {
        if (myShipId === getObjSpecId(violation.obj)) {
          console.warn(`teleport correction bail, dist = ${violation.diff}`);
        }
        jumpCorrectionToOldPosBack = jumpDir;
      } else {
        jumpCorrectionToOldPosBack = jumpDir
          .normalize()
          .scale(
            Math.min(
              maxShiftLen,
              jumpDir.length() -
                this.MAX_ALLOWED_JUMP_DESYNC_UNITS_PER_TICK * elapsedTicks
            )
          );
      }
      const objId = getObjSpecId(violation.obj)!;
      const newObj = findObjectById(currentState, objId)?.object;
      const newObjectPos = Vector.fromIVector(getObjectPosition(newObj));
      const correctedPos = newObjectPos.add(jumpCorrectionToOldPosBack);
      setObjectPosition(newObj, correctedPos);
      correctedObjectIds.add(objId);
    }
    this.violations = this.violations.filter((v) => {
      return !(
        v.tag === 'ObjectJump' && correctedObjectIds.has(getObjSpecId(v.obj))
      );
    });
    // if (correctedObjectIds.size > 0) {
    //   this.log.push(`corrected ${correctedObjectIds.size} violations`);
    // }
    if (this.violations.length > 0) {
      this.log.push(`remaining ${this.violations.length} violations`);
    } else {
      this.trueState = this.state; // bail out of independent update, it's resource-intensive and it only needed for correction
    }
    return currentState;
  }

  private overrideRotationsInstantly(state: GameState, trueState: GameState) {
    const checkableObjects = this.enumerateCheckableObjects(state);
    for (const { spec, obj } of checkableObjects) {
      const correctObj = this.findOldVersionOfObject(trueState, spec)?.object;
      if (correctObj) {
        setObjectRotation(obj, getObjectRotation(correctObj));
      }
    }
  }
}
