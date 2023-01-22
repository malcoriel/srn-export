import Vector, { IVector } from './utils/Vector';
import {
  findMyShip,
  findObjectBySpecifierLoc0,
  FindObjectResult,
  getObjectPosition,
  setObjectPosition,
} from './ClientStateIndexing';

import {
  AABB,
  Action,
  GameState,
  getObjSpecId,
  isInAABB,
  ObjectSpecifier,
  Ship,
} from './world';
import { Measure, Perf } from './HtmlLayers/Perf';
import _ from 'lodash';
import Color from 'color';
import * as uuid from 'uuid';
import { Wreck } from '../../world/pkg/world';
import { UnreachableCaseError } from 'ts-essentials';

type StateSyncerSuccess = { tag: 'success'; state: GameState };
type StateSyncerDesyncedSuccess = {
  tag: 'success desynced';
  state: GameState;
  desync: string;
};
type StateSyncerFullDesyncedSuccess = {
  tag: 'full desynced success';
  state: GameState;
  desync: string;
};
type StateSyncerError = { tag: 'error'; message: string };
export type StateSyncerResult =
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

// export const invariantAndPull = <T>(expr: any, message?: string): T => {
//   invariant(expr, message);
//   return expr as T;
// };

type StateSyncerEventServerState = {
  tag: 'server state';
  state: GameState;
  visibleArea: AABB;
};
export type StateSyncerEvent =
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

export const SHADOW_ID = uuid.v4();

export interface IStateSyncer {
  handle(StateSyncerEvent: StateSyncerEvent): StateSyncerResult;

  getCurrentState(): GameState;

  flushLog(): any[];

  handleServerConfirmedPacket(tag: string): void;

  validateArrayUniqueness(arr: { id: any }[], arrayKey: string): void;
}

export interface SyncerDeps {
  wasmUpdateWorld: any;
  wasmUpdateWorldIncremental: any;
  getShowShadow: () => boolean;
}

type PendingActionPack = {
  actions: Action[];
  packet_tag: string | null;
  happened_at_ticks: number;
  server_acknowledged: boolean;
};

const MAX_ALLOWED_CORRECTION_JUMP_CONST = 5 / 1000 / 1000;
// max 'too fast client' desync value, to skip too eager client frame. Since 1 update is roughly 16ms, then we must allow 1 frame ahead, but not 2
const MAX_ALLOWED_CLIENT_AHEAD_TICKS = 2 * 17 * 1000;
// if client is too much ahead, complete frame skipping may be notices, but what if we slow down the frame by factor X?
const CLIENT_AHEAD_DILATION_FACTOR = 0.5;

// due to frame skipping and network desync artifacts, to make UX better I suppress the displayed state changes when it's lower than this value. Essentially, lying about true state
const MAX_ALLOWED_VISUAL_DESYNC_UNITS = 0.3;
const MAX_PENDING_ACTIONS_LIFETIME_TICKS = 1000 * 1000; // if we don't clean up, client will keep them indefinitely and if server truly lost them, we're in trouble

// type TagConfirm = {
//   atClientTicks: number;
//   tag: string;
// };

export class StateSyncer implements IStateSyncer {
  private readonly wasmUpdateWorld;

  private readonly wasmUpdateWorldIncremental;

  private readonly getShowShadow;

  private eventCounter = 0;

  constructor(deps: SyncerDeps) {
    this.wasmUpdateWorld = deps.wasmUpdateWorld;
    this.wasmUpdateWorldIncremental = deps.wasmUpdateWorldIncremental;
    this.getShowShadow = deps.getShowShadow;
    this.validateReconciliationConfig();
  }

  getTrueMyShipState(): Ship | null {
    if (!this.trueState) {
      return null;
    }
    return _.cloneDeep(findMyShip(this.trueState));
  }

  private state!: GameState;

  private useCachedStateForUpdateContext = false;

  private trueState!: GameState;

  public handle = (event: StateSyncerEvent): StateSyncerResult => {
    try {
      this.cleanShadow();
      switch (event.tag) {
        case 'init': {
          return this.onInit(event);
        }
        case 'time update': {
          return this.onTimeUpdate(event);
        }
        case 'server state': {
          if (!this.state || this.state.id !== event.state.id) {
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
    } finally {
      this.addShadow();
    }
  };

  private addShadow() {
    if (!this.getShowShadow()) {
      return;
    }
    const desyncedShadow = this.getTrueMyShipState();
    if (desyncedShadow) {
      desyncedShadow.id = SHADOW_ID;
      desyncedShadow.color = new Color(desyncedShadow.color)
        .lighten(2.0) // actually lighten
        .hex()
        .toString();
      desyncedShadow.name = ' ';
      desyncedShadow.local_effects = [];
      this.state.locations[0].ships.push(desyncedShadow);
    }
  }

  private cleanShadow() {
    if (!this.state) {
      return;
    }
    this.state.locations[0].ships = this.state.locations[0].ships.filter(
      (ship: Ship) => ship.id !== SHADOW_ID
    );
  }

  private updateState(
    from: GameState,
    elapsedTicks: number,
    area: AABB,
    context: string
  ): GameState | null {
    const LONG_UPDATE_WARN = 500 * 1000;
    let nonDeterministic = false;
    if (elapsedTicks > LONG_UPDATE_WARN) {
      const clientAheadTicks =
        this.state.ticks + elapsedTicks - this.trueState.ticks;
      this.log.push(
        `warn: non deterministic update for ${Math.round(
          elapsedTicks / 1000
        )}ms (max ${Math.round(
          LONG_UPDATE_WARN / 1000
        )}ms) in ${context}, client ahead by ${Math.round(
          clientAheadTicks / 1000
        )}ms`
      );
      nonDeterministic = true;
    }
    const commonUpdateArgs = {
      limit_area: area,
      client: true,
      // since by default deterministic updates is iterative, updating for a long interval will take TIME / update_every_milliseconds of update iterations, which sucks
      force_non_determinism: nonDeterministic,
    };

    if (
      this.useCachedStateForUpdateContext &&
      context === 'onTimeUpdate current'
    ) {
      return this.wasmUpdateWorldIncremental(
        {
          state_tag: context,
          ...commonUpdateArgs,
        },
        elapsedTicks
      );
    }
    this.useCachedStateForUpdateContext = true; // make sure that next updates use incremental update mechanism
    return this.wasmUpdateWorld(
      {
        // the wasm code guarantees to return a copy, so it's safe to modify in-place here
        state: this.optimizeStateForWasmCall(from),
        state_tag: context,
        ...commonUpdateArgs,
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
      server_acknowledged: false,
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
    this.useCachedStateForUpdateContext = false;
    this.trueState = this.state; // invalidate whatever we had previously during correction, as client view has to win immediately, then get compensated
    return this.successCurrent();
  }

  private pendingActionPacks: PendingActionPack[] = [];

  private onServerState({
    state: serverState,
    visibleArea,
  }: StateSyncerEventServerState) {
    const hadHugeViolation = this.cleanupCommitedAndOutdatedPendingActions(
      serverState
    );
    this.trueState = serverState;
    if (hadHugeViolation) {
      // happens when there was a desync in history of actions, after which all compensations do not make sense
      this.state = this.trueState;
      this.useCachedStateForUpdateContext = false;
      console.warn('huge violation detected, state overwrite by server state');
      return this.successFullDesynced('xx');
    }
    this.eventCounter += 1;
    this.eventCounter = Math.max(10);
    // console.log(`server ${serverState.ticks} client ${this.state.ticks}`);
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

    const desyncValue = (this.state.millis - this.trueState.millis).toString();
    return this.successDesynced(desyncValue);
  }

  private cleanupCommitedAndOutdatedPendingActions(
    serverState: GameState
  ): boolean {
    let hadHugeViolation = false;
    const confirmedOnServerActionPacks = new Set(
      serverState.processed_player_actions.map((a: any) => a.packet_tag)
    );
    // dropping confirmed ones. this is normal operation
    this.pendingActionPacks = this.pendingActionPacks.filter(
      (a) => !confirmedOnServerActionPacks.has(a.packet_tag)
    );
    // if for some reason we just have trash in pending actions, or if server somehow explicitly dropped our action
    this.pendingActionPacks = this.pendingActionPacks.filter((a) => {
      if (
        Math.abs(this.state.ticks - a.happened_at_ticks) >
        MAX_PENDING_ACTIONS_LIFETIME_TICKS
      ) {
        // this is especially bad since it will lead to drastic desync between client and server state, due to
        // 'divergence' at some point back in time. In this situation, we should full bail out of client state and accept
        // the server state
        console.warn(
          'Dropping outdated or server-ignored pending action',
          a.actions,
          a.packet_tag,
          a.packet_tag ? `confirmed: ${a.server_acknowledged}` : 'untagged'
        );
        hadHugeViolation = true;
        return false;
      }
      return true;
    });
    return hadHugeViolation;
  }

  private rebaseStateUsingCurrentActions(
    state: GameState,
    elapsedTicks: number,
    visibleArea: AABB,
    context: string
  ): GameState | null {
    const alreadyExecutedTagsInState = new Set<string | null>(
      state.processed_player_actions.map(
        ({ packet_tag }: { packet_tag: string | null }) => packet_tag
      )
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
      return this.error('no state');
    }
    // sometimes there is no need to update state, e.g. right after the player action (optimistic updates)
    // or if there is no desync (everything got compensated)
    const weAreDesynced = this.trueState !== this.state;

    // console.log(
    //   `${weAreDesynced ? '! ' : ''}${this.trueState.ticks} client ${
    //     this.state.ticks
    //   }`
    // );
    const clientAheadTicks =
      this.state.ticks + event.elapsedTicks - this.trueState.ticks;
    let targetDiff = event.elapsedTicks;
    if (clientAheadTicks > MAX_ALLOWED_CLIENT_AHEAD_TICKS) {
      // console.warn(
      //   `frame dilation due to client too much ahead, ${clientAheadTicks} > ${MAX_ALLOWED_CLIENT_AHEAD_TICKS} ticks`
      // );
      targetDiff *= CLIENT_AHEAD_DILATION_FACTOR;
      // this.log.push(
      //   `client update dilate, ${event.elapsedTicks} -> ${targetDiff}`
      // );
    }

    Perf.usingMeasure(Measure.SyncedStateUpdate, () => {
      const updateResult = this.updateState(
        this.state,
        targetDiff,
        event.visibleArea,
        'onTimeUpdate current'
      );
      if (updateResult) {
        this.state = updateResult;
      } else {
        this.useCachedStateForUpdateContext = false;
      }
    });

    if (weAreDesynced) {
      Perf.usingMeasure(Measure.DesyncedStateUpdate, () => {
        // time has to pass for the server state as well
        this.trueState =
          this.rebaseStateUsingCurrentActions(
            this.trueState,
            event.elapsedTicks,
            event.visibleArea,
            'onTimeUpdate true'
          ) || this.trueState;
        // this.overrideNonMergeableKeysInstantly(this.state, this.trueState);
        // const stateClone = JSON.parse(JSON.stringify(this.state));
        // this.overrideKeysRecursive(stateClone, this.trueState, stateClone, []);
        // const diff = compare(this.state, stateClone);
        // this.log.push(JSON.stringify(diff));
        this.overrideKeysRecursive(this.state, this.trueState, this.state, []);
        this.violations = this.checkViolations(
          this.state,
          this.trueState,
          event.elapsedTicks,
          event.visibleArea
        );
        const violations = this.violations.filter(
          (v) => v.tag === 'ObjectJump'
        ) as SyncerViolationObjectJump[];
        this.state = this.applyMaxPossibleDesyncCorrection(
          violations,
          this.state,
          event.elapsedTicks
        );
        this.useCachedStateForUpdateContext = false;
        this.violations = this.checkViolations(
          this.state,
          this.trueState,
          event.elapsedTicks,
          event.visibleArea
        );
        if (this.violations.length > 0) {
          // this.log.push(`remaining ${this.violations.length} violations`);
        } else {
          // bail out of independent update, it's resource-intensive, and it is only needed for correction
          // that's why we need to 'preserve' overrides via overrideNonMergeableKeysInstantly
          this.trueState = this.state;
        }
      });
    } else {
      this.trueState = this.state;
    }

    if (this.trueState === this.state) {
      return this.successCurrent();
    }
    const desyncValue = (this.state.millis - this.trueState.millis).toString();
    return this.successDesynced(desyncValue);
  }

  private onInit(event: { tag: 'init'; state: GameState }) {
    this.state = event.state;
    this.useCachedStateForUpdateContext = false;
    this.trueState = this.state;
    this.pendingActionPacks = [];
    return this.successCurrent();
  }

  private successCurrent() {
    return { tag: 'success' as const, state: this.state };
  }

  private successDesynced(desync: string) {
    return { tag: 'success desynced' as const, state: this.state, desync };
  }

  private successFullDesynced(desync: string) {
    return { tag: 'full desynced success' as const, state: this.state, desync };
  }

  // noinspection JSMethodCanBeStatic
  private error(message: string) {
    return { tag: 'error' as const, message };
  }

  getCurrentState() {
    return this.state;
  }

  private violations: SyncerViolation[] = [];

  // noinspection JSUnusedGlobalSymbols
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
    currState: GameState,
    serverState: GameState,
    elapsedTicks: number,
    visibleArea: AABB
  ): SyncerViolation[] {
    const res = [];
    const checkableObjects = this.enumerateCheckableObjects(serverState);
    for (const { spec, obj } of checkableObjects) {
      if (!isInAABB(visibleArea, obj, 0.0)) {
        continue;
      }
      const oldObjInstance = this.findOldVersionOfObjectV2(currState, spec);
      if (oldObjInstance) {
        const oldObj = oldObjInstance;
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
    const ships = state.locations[0].ships
      .map((s: any) => {
        if (s.docked_at) return null;
        return {
          spec: { tag: 'Ship', id: s.id },
          obj: s,
        };
      })
      .filter((s: any) => !!s);
    res.push(...ships);
    return res as { spec: ObjectSpecifier; obj: any }[];
  }

  private findOldVersionOfObject<T = any>(
    targetState: GameState,
    spec: ObjectSpecifier
  ): null | FindObjectResult<T> {
    if (spec.tag !== 'Unknown') {
      const res = findObjectBySpecifierLoc0(targetState, spec);
      if (!res) {
        return null;
      }
      return {
        locIndex: 0,
        object: res,
      };
    }
    return null;
  }

  private findOldVersionOfObjectV2<T = any>(
    targetState: GameState,
    spec: ObjectSpecifier
  ): null | T {
    return findObjectBySpecifierLoc0(targetState, spec);
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
    for (const violation of violations) {
      const jumpDir = Vector.fromIVector(violation.to).subtract(
        Vector.fromIVector(violation.from)
      );
      let jumpCorrectionToTruePos: Vector;
      if (
        violation.diff / elapsedTicks >
        this.CORRECTION_TELEPORT_BAIL_PER_TICK
      ) {
        if (myShipId === getObjSpecId(violation.obj)) {
          console.warn(`teleport correction bail, dist = ${violation.diff}`);
        }
        jumpCorrectionToTruePos = jumpDir;
      } else {
        jumpCorrectionToTruePos = jumpDir
          .normalize()
          .scale(
            Math.min(
              maxShiftLen,
              jumpDir.length() -
                this.MAX_ALLOWED_JUMP_DESYNC_UNITS_PER_TICK * elapsedTicks
            )
          );
      }
      const newObj = findObjectBySpecifierLoc0(currentState, violation.obj);
      const newObjectPos = Vector.fromIVector(getObjectPosition(newObj));
      const correctedPos = newObjectPos.add(jumpCorrectionToTruePos);
      setObjectPosition(newObj, correctedPos);
    }
    return currentState;
  }

  handleServerConfirmedPacket(tag: string): void {
    const targetAp = this.pendingActionPacks.find(
      (ap) => ap.packet_tag === tag
    );
    if (!targetAp) {
      this.log.push(
        'warn: server tag for non-pending action received, probably there is a huge packet delay'
      );
      return;
    }
    targetAp.server_acknowledged = true;
  }

  private reconciliation = {
    // aka ignore server state / frozen objects, no reconciliation => easiest. anything purely visual,
    // may be bad for long action that arrive from server half-done already, e.g. shoot effects
    // overwrite will ignore server fields
    // timestamps like ticks typically also need to be here
    alwaysClient: new Set([
      'id', // there is a very special hook in the top-level handle method that will handle this instead
      'ticks',
      'millis',
      'accumulated_not_updated_ticks',
      'locations.*.planets.*.spatial', // ignore server updates completely, strictly speaking this is a fully derivable (right now) from ticks
      'locations.*.planets.*.movement',
      'locations.*.planets.*.rot_movement',
      'locations.*.planets.*.name',
      'locations.*.planets.*.anchor_tier',
      'locations.*.planets.*.color',
      'locations.*.star.name',
      'locations.*.star.color',
      'locations.*.star.corona_color',
      'locations.*.star.spatial',
      'locations.*.star.movement',
      'locations.*.star.rot_movement',
      'locations.*.asteroid_belts',
      'locations.*.ships.*.local_effects', // forcefully updated only for client in update world
      'locations.*.ships.*.local_effects_counter',
    ]),
    // overwrite state with server => bad for movement, good for numbers like hp
    // overwrite will drop client and replace it with server fields
    alwaysServer: new Set([
      'version',
      'mode',
      'tag',
      'seed',
      'next_seed',
      'my_id',
      'start_time_ticks',
      'players',
      'milliseconds_remaining',
      'paused',
      'leaderboard',
      'disable_hp_effects',
      'market',
      'interval_data',
      'game_over',
      'events',
      'processed_events',
      'player_actions',
      'processed_player_actions',
      'update_every_ticks',
      'gen_opts',
      'dialogue_states',
      'breadcrumbs',
      // locations
      'locations.*.seed',
      'locations.*.id',
      'locations.*.position',
      'locations.*.adjacent_location_ids',
      // ships
      'locations.*.ships.*.id',
      'locations.*.ships.*.docked_at',
      'locations.*.ships.*.dock_target',
      'locations.*.ships.*.color',
      'locations.*.ships.*.acc_periodic_dmg',
      'locations.*.ships.*.acc_periodic_heal',
      'locations.*.ships.*.abilities',
      'locations.*.ships.*.movement_definition',
      'locations.*.ships.*.long_actions',
      'locations.*.ships.*.navigate_target',
      'locations.*.ships.*.inventory',
      'locations.*.ships.*.tractor_target',
      'locations.*.ships.*.auto_focus',
      'locations.*.ships.*.hostile_auto_focus',
      'locations.*.ships.*.movement_markers',
      'locations.*.ships.*.health',
      'locations.*.ships.*.npc',
      'locations.*.ships.*.name',
      'locations.*.ships.*.turrets',
      'locations.*.ships.*.properties',
      'locations.*.ships.*.trading_with',
      'locations.*.ships.*.trajectory',
      'locations.*.ships.*.dock_target',

      'locations.*.star.id',
      'locations.*.planets.*.id',

      'locations.*.planets.*.health',
      'locations.*.planets.*.properties',
      'locations.*.minerals.*.x',
      'locations.*.minerals.*.y',
      'locations.*.minerals.*.id',
      'locations.*.minerals.*.radius',
      'locations.*.minerals.*.value',
      'locations.*.minerals.*.rarity',
      'locations.*.minerals.*.color',
      'locations.*.containers.*.id',
      'locations.*.containers.*.items',
      'locations.*.containers.*.position',
      'locations.*.containers.*.radius',
      'locations.*.containers.*.id',
      'locations.*.containers.*.items',
      'locations.*.containers.*.position',
      'locations.*.containers.*.radius',

      'locations.*.ships.*.spatial.velocity',
      'locations.*.ships.*.spatial.radius',
      'locations.*.ships.*.spatial.rotation_rad',
      'locations.*.wrecks',
    ]),
    // if server id has changed, invalidate the whole tree under the key. it's somewhat an optimization of the merge strategy
    // good for rarely-changed objects that have ids, e.g. stars, but which have to be overwritten by server data occasionally
    serverIfId: new Set(['locations.*.star']),
    // significant compensation effort, produces server shadows => needed for movement
    // overwrite will do nothing with those fields
    // OR -> reconciliate further, since subkeys can still be merged
    merge: new Set([
      'locations',
      'locations.*.planets',
      'locations.*.asteroids',
      'locations.*.minerals',
      'locations.*.containers',
      'locations.*.ships',
      'locations.*.ships.*.spatial',
      'locations.*.ships.*.spatial.position',
      'locations.*.ships.*.spatial.position.x',
      'locations.*.ships.*.spatial.position.y',
    ]),
  };

  // what object specifiers should be used for paths
  private objectSpecifierMapping = new Map<string, ObjectSpecifier['tag']>([
    ['locations', 'Location'],
    ['locations.*.ships', 'Ship'],
    ['locations.*.planets', 'Planet'],
    ['locations.*.asteroids', 'Asteroid'],
    ['locations.*.asteroid_belts', 'AsteroidBelt'],
    ['locations.*.minerals', 'Mineral'],
    ['locations.*.containers', 'Container'],
    ['locations.*.wrecks', 'Wreck'],
  ]);

  private normalizePath(pathParts: (string | number)[]): string {
    const result = pathParts
      .map((part) => (_.isNumber(part) ? '*' : part))
      .filter((p) => !_.isNil(p))
      .join('.');
    if (result === '*') {
      console.warn('reduced to *', pathParts);
    }
    return result;
  }

  private getPathReconStrategy(
    normalized: string,
    trueKey: (string | number)[]
  ): 'client' | 'server' | 'merge' | 'server if id' {
    if (this.reconciliation.alwaysClient.has(normalized)) {
      return 'client';
    }
    if (this.reconciliation.alwaysServer.has(normalized)) {
      return 'server';
    }
    if (this.reconciliation.merge.has(normalized)) {
      return 'merge';
    }
    if (this.reconciliation.serverIfId.has(normalized)) {
      return 'merge';
    }
    this.log.push(
      `warn: no reconciliation strategy for path ${normalized} ${trueKey}`
    );
    return 'server';
  }

  private overrideKeysRecursive(
    currState: any,
    trueState: any,
    rootCurrState: GameState,
    currentPath: (string | number)[]
  ) {
    if (!_.isObject(trueState || !_.isObject(currState))) {
      console.warn('not obj', currentPath, currState, trueState);
      return;
    }
    for (const [key, trueValue] of Object.entries(trueState)) {
      const extendedKey = [...currentPath, key];
      const normalizedExtendedKey = this.normalizePath(extendedKey);
      const strategy = this.getPathReconStrategy(
        normalizedExtendedKey,
        extendedKey
      );
      switch (strategy) {
        case 'client':
          // do nothing, state is ok
          break;
        case 'server':
          // full overwrite
          (currState as any)[key] = trueValue;
          break;
        case 'server if id': {
          if (currState[key]?.id !== trueState[key]?.id) {
            (currState as any)[key] = trueValue;
          }
          break;
        }
        case 'merge': {
          const currType = typeof currState[key];
          const trueType = typeof trueState[key];
          if (currType !== trueType) {
            this.log.push(
              `warn: value type mismatch for path ${normalizedExtendedKey}, curr=${currType}, true=${trueType}`
            );
            (currState as any)[key] = trueValue; // not clear how this happens, but e.g. happens for star when switching stories in storybook.
            continue;
          }
          if (_.isArray(trueValue)) {
            if (key.indexOf('wrecks') > -1) {
              console.log('merging wrecks');
            }
            if (!trueValue.every((obj) => obj.id)) {
              // potentially, I could validate for unique ids here, or provide surrogate index ids like react
              this.log.push(
                `warn: not every value in array at ${normalizedExtendedKey} has an id - cannot merge`
              );
              continue;
            }
            const objSpecTag = this.objectSpecifierMapping.get(
              normalizedExtendedKey
            );
            if (!objSpecTag) {
              this.log.push(
                `warn: refusing to merge path ${normalizedExtendedKey} without object specifier mapping`
              );
              continue;
            }

            // ships, planets, etc. - the most complex and expensive case
            const existingObjIds = new Set();
            for (let i = 0; i < trueValue.length; i++) {
              const trueObj = trueValue[i];
              existingObjIds.add(trueObj.id);
              const currentObj = this.findOldVersionOfObjectV2<any>(
                rootCurrState,
                {
                  tag: objSpecTag,
                  id: trueObj.id,
                }
              );
              if (currentObj) {
                this.overrideKeysRecursive(currentObj, trueObj, rootCurrState, [
                  ...extendedKey,
                  i,
                ]);
              } else {
                // add new objects
                currState[key].push(trueObj);
              }
            }
            // drop old objects
            currState[key] = currState[key].filter((obj: any) =>
              existingObjIds.has(obj.id)
            );
          } else if (_.isObject(trueValue)) {
            this.overrideKeysRecursive(
              currState[key],
              trueValue,
              rootCurrState,
              extendedKey
            );
          }
          break;
        }
        default:
          throw new UnreachableCaseError(strategy);
      }
    }
  }

  // some keys have to be always synced to the server
  // unused for now, kept in case recursive one fails
  // noinspection JSUnusedLocalSymbols
  private overrideNonMergeableKeysInstantly(
    state: GameState,
    trueState: GameState
  ) {
    const blacklistedKeys = new Set(['ticks', 'millis', 'locations']);
    for (const [key, value] of Object.entries(trueState)) {
      if (!blacklistedKeys.has(key)) {
        // typescript's object.entries is very dumb
        (state as any)[key] = value;
      }
    }
    const blacklistedShipKeys = new Set([
      'x',
      'y',
      'trajectory',
      'navigate_target',
      'dock_target',
    ]);
    // there are some ship fields that have to be overwritten no matter what
    const existingTrueShipIds = new Set();
    for (const trueShip of trueState.locations[0].ships) {
      existingTrueShipIds.add(trueShip.id);
      const currentShip = this.findOldVersionOfObjectV2<Ship>(state, {
        tag: 'Ship',
        id: trueShip.id,
      });
      if (currentShip) {
        for (const [key, value] of Object.entries(trueShip)) {
          if (blacklistedShipKeys.has(key)) {
            continue;
          }
          (currentShip as any)[key] = value;
          if (trueShip.docked_at !== currentShip.docked_at) {
            currentShip.docked_at = trueShip.docked_at;
            currentShip.spatial.position.x = trueShip.spatial.position.x;
            currentShip.spatial.position.y = trueShip.spatial.position.y;
          }
        }
      } else {
        // add new ships
        state.locations[0].ships.push(trueShip);
      }
    }
    // drop old ships
    state.locations[0].ships = state.locations[0].ships.filter((ship) =>
      existingTrueShipIds.has(ship.id)
    );

    const blacklistedWreckKeys = new Set();
    const existingShipWrecksIds = new Set();
    for (const trueWreck of trueState.locations[0].wrecks) {
      existingShipWrecksIds.add(trueWreck.id);
      const currentWreck = this.findOldVersionOfObjectV2<Wreck>(state, {
        tag: 'Wreck',
        id: trueWreck.id,
      });
      if (currentWreck) {
        for (const [key, value] of Object.entries(trueWreck)) {
          if (blacklistedWreckKeys.has(key)) {
            continue;
          }
          (currentWreck as any)[key] = value;
        }
      } else {
        state.locations[0].wrecks.push(trueWreck);
      }
    }
    // drop old wrecks
    state.locations[0].wrecks = state.locations[0].wrecks.filter((wreck) =>
      existingShipWrecksIds.has(wreck.id)
    );

    if (trueState.locations[0].star?.id !== state.locations[0].star?.id) {
      state.locations[0].star = trueState.locations[0].star;
    }

    const blacklistedPlanetKeys = new Set(['spatial']);
    const existingPlanetIds = new Set();
    for (const truePlanet of trueState.locations[0].planets) {
      existingPlanetIds.add(truePlanet.id);
      const currentPlanet = this.findOldVersionOfObjectV2<Wreck>(state, {
        tag: 'Planet',
        id: truePlanet.id,
      });
      if (currentPlanet) {
        for (const [key, value] of Object.entries(truePlanet)) {
          if (blacklistedPlanetKeys.has(key)) {
            continue;
          }
          (currentPlanet as any)[key] = value;
        }
      } else {
        state.locations[0].planets.push(truePlanet);
      }
    }
    // drop old planets
    state.locations[0].planets = state.locations[0].planets.filter((planet) =>
      existingPlanetIds.has(planet.id)
    );
  }

  // this is quite a dangerous optimization, that is nevertheless necessary
  // it hides some data form wasm update world completely, meaning that it won't ever be updated. This can only be done for the data that:
  // 1. Can be fully restored from something else (e.g. leaderboard)
  // 2. Never changes and was saved to wasm somehow (caching there, e.g. replay state)
  // 3. Something that doesn't matter to be updated for client (e.g. breadcrumbs)
  // 4. Something that is client-only, and somehow represents some UI state (also breadcrumbs)
  // 5. Something that cannot be processed by client update anyway but has to be received (e.g. events)
  private optimizeStateForWasmCall(state: GameState): GameState {
    state.breadcrumbs = [];
    state.processed_events = [];
    state.processed_player_actions = [];
    state.events = [];
    return state;
  }

  private validateReconciliationConfig() {
    const occurredAt = new Map<string, string[]>();
    const addKeys = (subKey: string) => {
      for (const key of (this.reconciliation as any)[subKey].keys()) {
        const current = occurredAt.get(key) || [];
        current.push(subKey);
        occurredAt.set(key, current);
      }
    };
    for (const key of Object.keys(this.reconciliation)) {
      addKeys(key);
    }
    for (const [key, occurrences] of occurredAt.entries()) {
      if (occurrences.length > 1) {
        console.warn(
          `Invalid reconciliation, key ${key} occurred in ${occurrences.join(
            ','
          )} but should appear only once`
        );
      }
    }
  }

  public validateArrayUniqueness(arr: { id: any }[], arrayKey: string) {
    const mapped = new Map();
    for (const elem of arr) {
      const strId = elem.id.toString();
      if (mapped.has(strId)) {
        console.warn(`Duplicate id ${strId} for ${arrayKey}`);
        console.warn('obj1', elem);
        console.warn('obj2', mapped.get(strId));
      }
      mapped.set(strId, elem);
    }
  }
}
