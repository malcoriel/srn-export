import {
  AABB,
  DEFAULT_STATE,
  GameMode,
  GameState,
  interpolateWorld,
  isInAABB,
  isManualMovement,
  loadReplayIntoWasm,
  ManualMovementActionTags,
  restoreReplayFrame,
  TradeAction,
  updateWorld,
} from './world';
import EventEmitter from 'events';
import * as uuid from 'uuid';
import {
  getActiveSyncActions,
  isSyncActionTypeActive,
  resetActiveSyncActions,
} from './utils/ShipControls';
import Vector, { IVector, VectorFzero } from './utils/Vector';
import { Measure, Perf, statsHeap } from './HtmlLayers/Perf';
import { vsyncedCoupledThrottledTime, vsyncedCoupledTime } from './utils/Times';
import { api } from './utils/api';
import { viewPortSizeMeters } from './coord';
import _ from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import {
  Action,
  Breadcrumb,
  InventoryAction,
  LongActionStart,
  NotificationActionR,
  SandboxCommand,
} from '../../world/pkg';
import {
  buildClientStateIndexes,
  ClientStateIndexes,
  findMyShip,
} from './ClientStateIndexing';
import { ActionBuilder } from '../../world/pkg/world.extra';

export type Timeout = ReturnType<typeof setTimeout>;

module?.hot?.dispose(() => {
  // for some reason CRA's client doesn't reload the page itself on hot.decline
  window.location.reload();
});

enum ClientOpCode {
  Unknown,
  ObsoleteSync,
  ObsoleteMutateMyShip,
  Name,
  ObsoleteDialogueOption,
  SwitchRoom,
  ObsoleteSandboxCommand,
  ObsoleteTradeAction,
  ObsoleteDialogueRequest,
  ObsoleteInventoryAction,
  ObsoleteLongActionStart,
  ObsoleteRoomJoin,
  ObsoleteNotificationAction,
  SchedulePlayerAction,
  SchedulePlayerActionBatch,
}

interface Cmd {
  code: ClientOpCode;
  value: any;
  tag?: string;
}

const AREA_BUFF_TO_COVER_SIZE = 1.5;
const RECONNECT_INTERVAL = 1000;

export type BreadcrumbLine = {
  position: IVector;
  to: IVector;
  color: string;
  timestamp_ticks: number;
  tag?: string;
};

export type VisualState = {
  boundCameraMovement: boolean;
  // real coordinates of the camera in the world
  cameraPosition: {
    x: number;
    y: number;
  };
  // proportion from default zoom
  zoomShift: number;
  breadcrumbs: (Breadcrumb | BreadcrumbLine)[];
};

const DEBUG_CREATION = false;

export enum ServerToClientMessageCode {
  Unknown,
  ObsoleteStateBroadcast,
  ObsoleteStateChangeExclusive,
  TagConfirm = 3,
  MulticastPartialShipsUpdate = 4,
  // intentionally unused
  UnicastDialogueStateChange = 5,
  XCastGameEvent = 6,
  RoomSwitched = 7,
  XCastGameState = 8,
  LeaveRoom = 9,
}

const EXTRAPOLATE_AHEAD_MS = 500 * 2;

const MAX_PENDING_TICKS = 2000;
// it's completely ignored in actual render, since vsynced time is used
const LOCAL_SIM_TIME_STEP = Math.floor(1000 / 30);
const SLOW_TIME_STEP = Math.floor(1000 / 8);
statsHeap.timeStep = LOCAL_SIM_TIME_STEP;
// when either a game was restarted, or loaded in sandbox mode, all timings will be off and normal lag-compensation will go crazy
// or if it lagged so hard that it's pointless to compensate
const FULL_DESYNC_DETECT_MS = 500.0;
// this has to be less than expiry (500ms) minus ping
const MANUAL_MOVEMENT_SYNC_INTERVAL_MS = 200;

const normalLog = (...args: any[]) => console.log(...args);
const normalWarn = (...args: any[]) => console.warn(...args);
const normalErr = (...args: any[]) => console.error(...args);
export const DISPLAY_BREADCRUMBS_LAST_TICKS = 5 * 1000 * 1000; // 5s

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;

  // actual state used for rendering = interpolate(prevState, nextState, value=0..1)
  state!: GameState;

  // last calculated state, either result of local actions,
  // updated by timer
  prevState!: GameState;

  // delayed serverState, last known data from server
  serverState!: GameState;

  // extrapolated state used for calculating the actual state via interpolation
  nextState!: GameState;

  indexes!: ClientStateIndexes;

  nextIndexes!: ClientStateIndexes;

  public connecting = true;

  public playerName = 'player';

  public portraitName = '1';

  public ping: number;

  public maxPing?: number;

  public visualState: VisualState;

  private static instance?: NetState;

  private updateOnServerInterval?: Timeout;

  private reconnectTimeout?: Timeout;

  readonly id: string;

  disconnecting = false;

  private slowTime: vsyncedCoupledThrottledTime;

  public desync: number;

  public lastReceivedServerTicks: number;

  private readonly lastSendOfManualMovementMap: Record<
    ManualMovementActionTags,
    number
  >;

  private lastSlowChangedState!: GameState;

  private lastSlowChangedIndexes!: ClientStateIndexes;

  private mode!: GameMode;

  private switchingRooms = false;

  public replay: any;

  public playingReplay = false;

  public scheduleUpdateLocalState = false;

  public static make(): NetState {
    NetState.instance = new NetState();
    return NetState.instance;
  }

  public static get(): NetState | undefined {
    return NetState.instance;
  }

  private time: vsyncedCoupledTime;

  public visMap: Record<string, boolean>;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.id = uuid.v4();
    const newVar = DEBUG_CREATION ? `at ${new Error().stack}` : '';
    normalLog(`created NS ${this.id} ${newVar}`);
    this.resetState();
    this.ping = 0;
    this.desync = 0;
    this.lastReceivedServerTicks = -1;
    this.lastSendOfManualMovementMap = {
      Gas: 0,
      Reverse: 0,
      TurnRight: 0,
      TurnLeft: 0,
    };
    this.visualState = {
      boundCameraMovement: true,
      cameraPosition: {
        x: 0,
        y: 0,
      },
      zoomShift: 1,
      breadcrumbs: [],
    };
    this.visMap = {};
    this.time = new vsyncedCoupledTime(LOCAL_SIM_TIME_STEP);
    this.slowTime = new vsyncedCoupledThrottledTime(SLOW_TIME_STEP);
  }

  private updateVisMap() {
    const AABB = this.getSimulationArea();
    this.visMap = {};
    for (const ship of this.state.locations[0].ships) {
      this.visMap[ship.id] = isInAABB(AABB, ship, ship.radius);
    }
    for (const planet of this.state.locations[0].planets) {
      this.visMap[planet.id] = isInAABB(
        AABB,
        planet.spatial.position,
        planet.spatial.radius
      );
    }
    const star = this.state.locations[0].star;
    if (star) {
      this.visMap[star.id] = isInAABB(
        AABB,
        star.spatial.position,
        star.spatial.radius
      );
    }
  }

  private extrapolate() {
    const nextState = updateWorld(
      this.prevState,
      this.getSimulationArea(),
      EXTRAPOLATE_AHEAD_MS
    );
    if (nextState) {
      this.nextState = nextState;
      this.nextIndexes = buildClientStateIndexes(this.nextState);
      this.addExtrapolateBreadcrumbs();
    } else {
      normalWarn('extrapolation failed');
    }
  }

  private reindexNetState = () => {
    this.reindexCurrentState();
    this.nextIndexes = buildClientStateIndexes(this.nextState);
  };

  private reindexCurrentState() {
    this.indexes = buildClientStateIndexes(this.state);
  }

  private resetState() {
    this.state = _.clone(DEFAULT_STATE);
    this.nextState = _.clone(DEFAULT_STATE);
    this.prevState = _.clone(DEFAULT_STATE);
    this.reindexNetState();
  }

  disconnectAndDestroy = () => {
    this.disconnecting = true;
    normalLog(`disconnecting NS ${this.id}`);
    if (this.socket) {
      this.socket.close();
    }
    if (this.updateOnServerInterval) {
      clearInterval(this.updateOnServerInterval);
    }
    if (this.reconnectTimeout) {
      clearInterval(this.reconnectTimeout);
    }
    this.time.clearAnimation();
    this.slowTime.clearAnimation();
    Perf.stop();
    this.emit('disconnect');
    NetState.instance = undefined;
  };

  init = (mode: GameMode): Promise<void> => {
    this.mode = mode;
    normalLog(`initializing NS ${this.id}`);
    this.connecting = true;
    Perf.start();
    this.time.setInterval(
      (elapsedMs: number) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;
          if (this.connecting) {
            return;
          }
          if (this.switchingRooms) {
            // eslint-disable-next-line no-useless-return
            return;
          }
          // not using elapsedMs here since this function will track it itself
          // in relation to last forced update, as force can also happen on network load
          // and player actions directly
          if (this.scheduleUpdateLocalState) {
            // this is a special limitation so the forced-update happens on 'synchronous' ship actions so optimistic
            // application happens without waiting for the server
            this.scheduleUpdateLocalState = false;
            this.forceUpdateLocalStateForOptimisticSync();
          }
          if (this.indexes.myShipPosition) {
            this.detectJumpInMyShipPos(
              elapsedMs,
              this.indexes.myShipPosition,
              'pink'
            );
          }
        });
      },
      (elapsedMs) => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;
          this.interpolateCurrentState(elapsedMs);
          ns.emit('change');
        });
      }
    );
    this.slowTime.setInterval(
      () => {
        const ns = NetState.get();
        if (!ns) return;

        Perf.markEvent(Measure.SlowUpdateFrameEvent);
        Perf.usingMeasure(Measure.SlowUpdateFrameTime, () => {
          ns.emit(
            'slowchange',
            this.lastSlowChangedState,
            this.state,
            this.lastSlowChangedIndexes,
            this.indexes
          );
          this.lastSlowChangedState = _.clone(this.state);
          this.lastSlowChangedIndexes = _.clone(this.indexes);
          this.cleanupBreadcrumbs();
        });
      },
      () => {}
    );
    return this.connect();
  };

  rewindReplayToMs = (markInMs: number) => {
    this.replay.current_millis = markInMs;
    const [closestMark, nextMark] = this.findClosestMarks(
      this.replay.marks_ticks,
      markInMs
    );
    if (closestMark !== null) {
      if (this.replay?.current_state?.ticks !== markInMs) {
        // technically, this is incorrect after the continuous restoration was implemented.
        // it should be treated as 'previous solid snapshot' state, and the current, interpolated state,
        // should be a different field. However, since the replay is preloaded and this data is never sent
        // to wasm anymore, it's safe to abuse this field, for now at least
        this.replay.current_state = restoreReplayFrame(
          closestMark,
          nextMark,
          markInMs * 1000
        );
        this.state = this.replay.current_state;
        this.updateVisMap();
        this.reindexNetState();
      }
    } else {
      normalWarn(`No best mark for ${markInMs}`);
      this.pauseReplay();
    }
    this.emit('change');
  };

  initReplay = async (replayId: string) => {
    normalLog(`initializing replay NS ${this.id} for replay ${replayId}`);
    this.connecting = true;
    const replayJson: any = await api.downloadReplayJson(replayId);
    normalLog('replay downloaded');
    this.connecting = false;
    this.mode = replayJson.initial_state.mode;
    this.replay = replayJson;
    loadReplayIntoWasm(replayJson);
    this.state = this.replay.initial_state;
    Perf.start();
    this.time.setInterval(
      (elapsedMs) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;
          if (this.connecting) {
            return;
          }
          if (!this.playingReplay) {
            return;
          }
          const markInMs = this.replay.current_millis + elapsedMs;
          ns.rewindReplayToMs(markInMs);
        });
      },
      () => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;

          ns.emit('change');
        });
      }
    );
    this.slowTime.setInterval(
      () => {
        const ns = NetState.get();
        if (!ns) return;

        Perf.markEvent(Measure.SlowUpdateFrameEvent);
        Perf.usingMeasure(Measure.SlowUpdateFrameTime, () => {
          ns.emit('slowchange', this.lastSlowChangedState, this.state);
          this.lastSlowChangedState = _.clone(this.state);
        });
      },
      () => {}
    );
  };

  connect = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (this.disconnecting) {
        reject(new Error('Currently disconnecting'));
        return;
      }
      normalLog(`connecting NS ${this.id}`);
      this.socket = new WebSocket(api.getWebSocketUrl(), 'rust-websocket');
      this.socket.onmessage = (event) => {
        Perf.markEvent(Measure.SocketFrameEvent);
        Perf.usingMeasure(Measure.SocketFrameTime, () => {
          this.handleMessage(event.data);
        });
      };
      this.socket.onclose = () => {
        if (!this.disconnecting) {
          this.emit('network');
        }
        this.socket = null;
        this.state.millis = 0;
        this.reconnectTimeout = setTimeout(() => {
          this.connecting = true;
          this.connect();
        }, RECONNECT_INTERVAL);
      };
      this.socket.onopen = () => {
        this.connecting = false;
        this.visualState.boundCameraMovement = true;

        const switchRoomTag = uuid.v4();
        this.switchingRooms = true;
        (async () => {
          const roomId = await api.getRoomToJoin(this.mode);
          this.send({
            code: ClientOpCode.SwitchRoom,
            value: { room_id: roomId, client_name: this.playerName },
            tag: switchRoomTag,
          });
          resolve();
        })();
      };
      this.socket.onerror = () => {
        normalWarn('socket error');
        this.resetState();
        if (!this.disconnecting) {
          this.emit('network');
        }
        if (this.socket) {
          this.socket.close();
        }
      };
    });
  };

  private addExtrapolateBreadcrumbs = () => {
    this.visualState.breadcrumbs = this.visualState.breadcrumbs.filter(
      (b) => b.tag !== 'extrapolate'
    );
    const myNextShip = this.nextIndexes.myShip;
    if (myNextShip) {
      this.visualState.breadcrumbs.push({
        position: Vector.fromIVector(myNextShip),
        color: 'green',
        timestamp_ticks: this.state.ticks,
        tag: 'extrapolate',
      });
    }
    const myPrevShip = findMyShip(this.prevState);
    if (myPrevShip) {
      this.visualState.breadcrumbs.push({
        position: Vector.fromIVector(myPrevShip),
        color: 'yellow',
        timestamp_ticks: this.state.ticks,
        tag: 'extrapolate',
      });
    }
    if (myNextShip && myPrevShip) {
      this.visualState.breadcrumbs.push({
        position: Vector.fromIVector(myPrevShip),
        to: Vector.fromIVector(myNextShip),
        color: 'yellow',
        timestamp_ticks: this.state.ticks,
        tag: 'extrapolate',
      });
    }
  };

  private cleanupBreadcrumbs = () => {
    this.visualState.breadcrumbs = this.visualState.breadcrumbs.filter(
      ({ timestamp_ticks }) =>
        timestamp_ticks + DISPLAY_BREADCRUMBS_LAST_TICKS > this.state.ticks
    );
  };

  private handleMessage(rawData: string) {
    try {
      const [messageCodeStr, data] = rawData.split('_%_');

      const messageCode = Number(messageCodeStr);

      if (this.switchingRooms) {
        this.resetState(); // force to have initial state
        if (messageCode !== ServerToClientMessageCode.RoomSwitched) {
          // block updates unless it is switch success
          return;
        }
        this.switchingRooms = false;
        this.send({
          code: ClientOpCode.Name,
          value: JSON.stringify({
            name: this.playerName,
            portrait_name: this.portraitName,
          }),
        });
        return;
      }

      if (
        messageCode === ServerToClientMessageCode.ObsoleteStateBroadcast ||
        messageCode ===
          ServerToClientMessageCode.ObsoleteStateChangeExclusive ||
        messageCode === ServerToClientMessageCode.XCastGameState
      ) {
        const parsed = JSON.parse(data);
        this.desync = parsed.millis - this.state.millis;
        this.lastReceivedServerTicks = this.serverState?.millis || 0;
        // this is not always true in case of packet loss, so probably better ping calculation should be in place -
        // probably just putting the update frequency in the state?
        // const serverUpdateIntervalMs = Math.abs(
        //   parsed.millis - this.serverState?.millis || 0
        // );

        // const isDesyncSmallNegative =
        //   this.desync < 0 &&
        //   Math.abs(this.desync) < Math.abs(serverUpdateIntervalMs);
        this.serverState = _.clone(parsed);
        // const potentialNewPing = serverUpdateIntervalMs - this.desync;
        // console.table({
        //   serverMillis: parsed.millis,
        //   stateMillis: this.state.millis,
        //   desync: this.desync,
        //   serverUpdateIntervalMs,
        //   newPing:
        //     isDesyncSmallNegative && potentialNewPing > 0
        //       ? potentialNewPing
        //       : this.ping,
        // });
        // if (isDesyncSmallNegative) {
        //   // assuming the server is behind client (and client didn't terribly lag), but not too much, so
        //   // we don't overexert local simulation
        //   if (potentialNewPing >= 0) {
        //     // negative means desync is so big that calculation cannot be applied, e.g. due to server lag or big packet loss,
        //     // so it cannot be calculated here
        //     this.ping = potentialNewPing;
        //   }
        // }

        // this.addCurrentShipBreadcrumb('red');

        // TODO with new interpolation approach, this needs to be corrected to timestamp-match the previous prevState

        if (Math.abs(this.desync) > FULL_DESYNC_DETECT_MS) {
          console.warn(
            'full desync detected, overriding the local state fully'
          );
          this.prevState = _.clone(parsed);
          this.state = _.clone(parsed);
          const newShip = findMyShip(this.state);
          if (newShip) {
            this.detectJumpInMyShipPos(0, Vector.fromIVector(newShip), 'red');
            // same position because prevState == state now
            this.detectJumpInMyPrevShipPos(
              0,
              Vector.fromIVector(newShip),
              'red'
            );
          }
        } else if (this.desync < 0) {
          // normal client-ahead-of-server
          this.prevState = this.rebaseReceivedStateToCurrentPoint(
            parsed,
            -this.desync,
            this.pendingActionPacks
          );
          const newShip = findMyShip(this.prevState);
          if (newShip) {
            this.detectJumpInMyPrevShipPos(
              0,
              Vector.fromIVector(newShip),
              null
            );
          }
          // const newShip = findMyShip(this.prevState);
          // if (newShip) {
          //   this.detectJumpInMyShipPos(0, Vector.fromIVector(newShip), 'green');
          // }
          // console.log(
          //   'rebased prevState millis',
          //   this.prevState.millis,
          //   'on top of',
          //   this.serverState.millis
          // );
        } else {
          // this means that client lagged and server is ahead of it, which shouldn't be the case
          // or it's still synchronizing in the beginning
          this.prevState = this.rebaseReceivedStateToCurrentPoint(
            parsed,
            10, // magic constant to bump client a little bit ahead so it doensn't have to accept it next time
            this.pendingActionPacks
          );
          const newShip = findMyShip(this.prevState);
          if (newShip) {
            this.detectJumpInMyPrevShipPos(
              0,
              Vector.fromIVector(newShip),
              null
            );
          }
          // console.log(
          //   'accepted server state with a magic bump',
          //   this.prevState.millis,
          //   'on top of',
          //   this.serverState.millis
          // );
        }

        // after receiving server state, we might receive a state that doesn't contain the command we just sent, which
        // will result in command rollback with nasty visual effect. To deal with it, we save non-confirmed commands
        // in pendingActions and reapply them here after normal compensation techniques
        const toDrop = new Set();
        // noinspection JSUnusedLocalSymbols
        for (const [tag, actions, millis] of this.pendingActionPacks) {
          const age = Math.abs(millis - this.state.millis);
          if (age > MAX_PENDING_TICKS) {
            console.warn(
              `dropping pending actions packs ${tag} with age ${age}>${MAX_PENDING_TICKS}`
            );
            toDrop.add(tag);
          } else {
            // console.log(
            //   `re-applying pending actions ${tag} with types ${actions.map(
            //     (a) => a.type
            //   )}`
            // );
            this.state.player_actions = [];
            for (const cmd of actions) {
              this.state.player_actions.push([cmd, null]);
            }
          }
        }
        this.pendingActionPacks = this.pendingActionPacks.filter(
          ([tag]) => !toDrop.has(tag)
        );

        this.extrapolate();
      } else if (messageCode === ServerToClientMessageCode.TagConfirm) {
        const confirmedTag = JSON.parse(data).tag;
        // console.log('confirmed', confirmedTag);

        const prevLen = this.pendingActionPacks.length;
        this.pendingActionPacks = this.pendingActionPacks.filter(
          ([tag]) => tag !== confirmedTag
        );
        const newLen = this.pendingActionPacks.length;
        // if (newLen < prevLen) {
        //   console.log(`confirmed pending pack ${confirmedTag}`);
        // }
      } else if (
        messageCode === ServerToClientMessageCode.MulticastPartialShipsUpdate
      ) {
        // 1. it is always about other ships, since server always excludes the updater from the update recipients
        // so to avoid juggling actions above and so on, just skip my own ship update
        // 2. it is also mostly an optimization to avoid sending the whole state because of other's actions
        // 3. it can be further optimized by only sending the changed ship
        // 4. without it, manual movement updates not so often (only via full syncs), so this leads to very bad look
        const ships = JSON.parse(data).ships;
        const myOldShip = findMyShip(this.state);
        this.state.locations[0].ships = ships;
        if (myOldShip) {
          this.state.locations[0].ships = this.state.locations[0].ships.map(
            (s: any) => {
              if (s.id === myOldShip.id) {
                return myOldShip;
              }
              return s;
            }
          );
        }
      } else if (messageCode === ServerToClientMessageCode.XCastGameEvent) {
        const event = JSON.parse(data).value;
        this.emit('gameEvent', event);
      } else if (messageCode === ServerToClientMessageCode.LeaveRoom) {
        normalLog('Received disconnect request from server');
        this.disconnectAndDestroy();
      } else {
        normalWarn('unknown message code', messageCode);
      }
      this.reindexNetState();
    } catch (e) {
      normalWarn('error handling message', e);
    } finally {
      this.updateVisMap();
    }
  }

  private send(cmd: Cmd) {
    if (this.socket && !this.connecting) {
      switch (cmd.code) {
        case ClientOpCode.ObsoleteDialogueOption:
        case ClientOpCode.ObsoleteSandboxCommand:
        case ClientOpCode.ObsoleteTradeAction:
        case ClientOpCode.ObsoleteSync:
        case ClientOpCode.ObsoleteDialogueRequest:
        case ClientOpCode.ObsoleteInventoryAction:
        case ClientOpCode.ObsoleteLongActionStart:
        case ClientOpCode.ObsoleteNotificationAction:
        case ClientOpCode.ObsoleteRoomJoin:
        case ClientOpCode.ObsoleteMutateMyShip: {
          normalWarn('unsupported command');
          break;
        }
        case ClientOpCode.Unknown: {
          normalWarn(`Unknown opcode ${cmd.code}`);
          break;
        }
        case ClientOpCode.Name: {
          this.socket.send(`${cmd.code}_%_${cmd.value}`);
          break;
        }
        case ClientOpCode.SwitchRoom:
        case ClientOpCode.SchedulePlayerAction: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.SchedulePlayerActionBatch: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        default:
          throw new UnreachableCaseError(cmd.code);
      }
    }
  }

  // [tag, action, ticks], the order is the order of appearance
  private pendingActionPacks: [string, Action[], number][] = [];

  forceUpdateLocalStateForOptimisticSync = () => {
    this.updateLocalState(Math.ceil(this.state.update_every_ticks / 1000)); // do a minimal update. this will cause a very small desync forward, but will flush out all the actions
    this.prevState = _.clone(this.state);
    const myShip = findMyShip(this.prevState);
    if (myShip) {
      this.detectJumpInMyPrevShipPos(0, Vector.fromIVector(myShip), null);
    }
    this.extrapolate();
  };

  updateLocalState = (elapsedMs: number) => {
    // block all controls in inactive game state
    if (this.state.paused) {
      resetActiveSyncActions();
      return;
    }

    const actionsToSync = getActiveSyncActions();

    const actionsToSend = [];
    for (const action of actionsToSync) {
      // prevent server DOS via gas action flooding, separated by action type
      if (isManualMovement(action)) {
        if (
          // @ts-ignore
          this.lastSendOfManualMovementMap[action.tag] &&
          Math.abs(
            // @ts-ignore
            this.lastSendOfManualMovementMap[action.tag] - performance.now()
          ) < MANUAL_MOVEMENT_SYNC_INTERVAL_MS
        ) {
          continue;
        } else {
          // @ts-ignore
          this.lastSendOfManualMovementMap[action.tag] = performance.now();
        }
      }
      actionsToSend.push(action);
    }
    const sentBatchTag = this.sendSchedulePlayerActionBatch(actionsToSend);

    // schedule for optimistic update
    this.state.player_actions = [];
    for (const cmd of actionsToSync) {
      this.state.player_actions.push([cmd, null]);
    }

    this.pendingActionPacks.push([
      sentBatchTag,
      actionsToSync,
      this.state.millis + elapsedMs,
    ]);

    if (isSyncActionTypeActive('Move')) {
      this.visualState.boundCameraMovement = true;
    }

    resetActiveSyncActions();

    const result = updateWorld(this.state, this.getSimulationArea(), elapsedMs);
    if (result) {
      this.state = result;
      this.reindexNetState();
      this.updateVisMap();
    }
  };

  public sendDialogueOption(dialogueId: string, optionId: string) {
    this.sendSchedulePlayerAction(
      ActionBuilder.ActionSelectDialogueOption({
        dialogue_id: dialogueId,
        option_id: optionId,
        player_id: this.state.my_id,
      })
    );
  }

  public sendSchedulePlayerAction(action: Action) {
    const tag = uuid.v4();
    this.send({
      code: ClientOpCode.SchedulePlayerAction,
      value: { action },
      tag,
    });
  }

  public sendSchedulePlayerActionBatch(actions: Action[]): string {
    const tag = uuid.v4();
    this.send({
      code: ClientOpCode.SchedulePlayerActionBatch,
      value: { actions },
      tag,
    });
    return tag;
  }

  private getSimulationArea(): AABB {
    const viewportSize = viewPortSizeMeters()
      .scale(1 / this.visualState.zoomShift)
      .scale(AREA_BUFF_TO_COVER_SIZE);
    const center = this.visualState.cameraPosition;
    return {
      top_left: new Vector(
        center.x - viewportSize.x / 2,
        center.y - viewportSize.y / 2
      ),
      bottom_right: new Vector(
        center.x + viewportSize.x / 2,
        center.y + viewportSize.y / 2
      ),
    };
  }

  public sendSandboxCmd(cmd: SandboxCommand) {
    this.sendSchedulePlayerAction(
      ActionBuilder.ActionSandboxCommand({
        player_id: this.state.my_id,
        command: cmd,
      })
    );
  }

  public sendTradeAction(cmd: TradeAction) {
    this.sendSchedulePlayerAction(
      ActionBuilder.ActionTrade({
        player_id: this.state.my_id,
        action: cmd,
      })
    );
  }

  public sendInventoryAction(invAct: InventoryAction) {
    this.sendSchedulePlayerAction(
      ActionBuilder.ActionInventory({
        player_id: this.state.my_id,
        action: invAct,
      })
    );
  }

  public startLongAction(longAction: LongActionStart) {
    if (this.indexes.myShip) {
      const act = ActionBuilder.ActionLongActionStart({
        long_action_start: longAction,
        player_id: this.state.my_id,
        ship_id: this.indexes.myShip.id,
      });
      this.state.player_actions.push([act, null]);
      this.sendSchedulePlayerAction(act);
    }
  }

  public sendNotificationAction(notAction: NotificationActionR) {
    this.sendSchedulePlayerAction(
      ActionBuilder.ActionNotification({
        action: notAction,
        player_id: this.state.my_id,
      })
    );
  }

  pauseReplay = () => {
    this.playingReplay = false;
  };

  resumeReplay = () => {
    this.playingReplay = true;
  };

  private lastMyShipPos: null | Vector = null;

  private lastPrevMyShipPos: null | Vector = null;

  private MAX_ALLOWED_JUMP_PER_MS = 0.03;

  private detectJumpInMyShipPos = (
    elapsedMs: number,
    newShipPos: Vector,
    color: string
  ) => {
    if (this.lastMyShipPos && newShipPos) {
      if (
        this.lastMyShipPos.euDistTo(newShipPos) >
        elapsedMs * this.MAX_ALLOWED_JUMP_PER_MS
      ) {
        this.visualState.breadcrumbs.push({
          position: this.lastMyShipPos,
          to: newShipPos,
          color,
          timestamp_ticks: this.state.ticks,
        });
      }
    }
    this.lastMyShipPos = newShipPos;
  };

  private detectJumpInMyPrevShipPos = (
    elapsedMs: number,
    newPrevShipPos: Vector,
    color: string | null
  ) => {
    if (this.lastPrevMyShipPos && newPrevShipPos) {
      if (
        this.lastPrevMyShipPos.euDistTo(newPrevShipPos) >
          elapsedMs * this.MAX_ALLOWED_JUMP_PER_MS &&
        color
      ) {
        this.visualState.breadcrumbs.push({
          position: this.lastPrevMyShipPos,
          to: newPrevShipPos,
          color,
          timestamp_ticks: this.state.ticks,
        });
      }
    }
    this.lastPrevMyShipPos = newPrevShipPos;
  };

  private findClosestMarks(
    keys: number[],
    markInMs: number
  ): [number | null, number | null] {
    const markInTicks = markInMs * 1000;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      if (key <= markInTicks && nextKey > markInTicks) {
        return [key, nextKey];
      }
    }
    if (keys[keys.length - 1] <= markInTicks) {
      return [keys[keys.length - 1], null];
    }
    return [null, null];
  }

  private interpolateCurrentState(elapsedMs: number) {
    if (this.prevState.id && this.nextState.id) {
      // elapsedMs = time since last update
      const currentMs = this.state.millis + elapsedMs;
      const baseMs = this.prevState.millis;
      const nextMs = this.nextState.millis;
      const value = (currentMs - baseMs) / (nextMs - baseMs);
      // if we have received any 'real' state from server
      if (value > 0) {
        // for some reason, right after server update value is < 0
        const interpolated = interpolateWorld(
          this.prevState,
          this.nextState,
          value,
          this.getSimulationArea()
        );
        // this.controlForOuterPlanet(this.prevState, this.nextState);
        this.state = interpolated || this.state;
        // console.log('true interpolate', this.state.millis, value.toFixed(3));
      } else {
        this.state = _.clone(this.prevState);
        // console.log(
        //   `interpolation bump due to client lag, may look bad, diff=${(
        //     baseMs - currentMs
        //   ).toFixed(0)}ms`
        // );
      }
    } else {
      this.state = _.clone(this.prevState);
      // console.log('interpolation impossible, no valid boundaries');
    }
    this.reindexCurrentState();
    if (this.indexes.myShipPosition) {
      // this.visualState.breadcrumbs.push({
      //   color: 'pink',
      //   timestamp_ticks: this.state.ticks,
      //   position: this.indexes.myShipPosition,
      // });
    }
  }

  private rebaseReceivedStateToCurrentPoint(
    parsed: GameState,
    adjustMillis: number,
    pendingActionPacks: [string, Action[], number][] // tag, actions, atMillis
  ): GameState {
    // too much stuff here and it will slow down itself (unless I add again the instant-update mode without iterations, which is non-deterministic then)
    const MAX_ACCEPTABLE_REBASE_ADJUST = 100;
    if (adjustMillis > MAX_ACCEPTABLE_REBASE_ADJUST) {
      // console.warn(
      //   `refusing to adjust state due to huge difference ${adjustMillis} > max=${MAX_ACCEPTABLE_REBASE_ADJUST}`
      // );
      parsed.millis += adjustMillis;
      return parsed;
    }
    // console.log(
    //   'executing rebase server state',
    //   parsed.millis,
    //   'with adjustMillis',
    //   adjustMillis
    // );
    // return parsed;

    // may not be exactly correct, since different actions happen in different moments in the past, and such reapplication
    // literally changes the outcome - however, it's unclear how to combine it with adjustMillis for now
    const alreadyExecutedTagsInState = new Set(
      parsed.processed_player_actions.map(({ packet_tag }) => packet_tag)
    );
    const actionsToRebase = pendingActionPacks.reduce(
      (acc, [tag, actions]: [string, Action[], number]) => {
        if (!alreadyExecutedTagsInState.has(tag)) {
          return [...acc, ...actions];
        }
        return acc;
      },
      [] as Action[]
    );

    const rebasedActs = actionsToRebase.map((a) => [a, null] as [Action, null]);
    parsed.player_actions.push(...rebasedActs);
    return (
      updateWorld(parsed, this.getSimulationArea(), adjustMillis) || parsed
    );
  }
}
