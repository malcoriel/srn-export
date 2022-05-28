import {
  AABB,
  DEFAULT_STATE,
  GameMode,
  GameState,
  interpolateWorld,
  isManualMovement,
  loadReplayIntoWasm,
  ManualMovementActionTags, MaxedAABB,
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
import Vector, { IVector } from './utils/Vector';
import { Measure, Perf, statsHeap } from './HtmlLayers/Perf';
import { vsyncedCoupledThrottledTime, vsyncedCoupledTime } from './utils/Times';
import { api } from './utils/api';
import { viewPortSizeMeters } from './coord';
import _ from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import {
  Action,
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
}

interface Cmd {
  code: ClientOpCode;
  value: any;
  tag?: string;
}

const AREA_BUFF_TO_COVER_SIZE = 1.5;
const RECONNECT_INTERVAL = 1000;

export type VisualState = {
  boundCameraMovement: boolean;
  // real coordinates of the camera in the world
  cameraPosition: {
    x: number;
    y: number;
  };
  // proportion from default zoom
  zoomShift: number;
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

const isInAABB = (bounds: AABB, obj: IVector, radius: number): boolean => {
  return (
    bounds.top_left.x - radius <= obj.x &&
    obj.x <= bounds.bottom_right.x + radius &&
    bounds.top_left.y - radius <= obj.y &&
    obj.y <= bounds.bottom_right.y + radius
  );
};

// Theoretically, we need that only for BROADCAST_SLEEP_MS from main.ws - however, we might need more in case something lags, so x 2
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

  private lastUpdateTimeMsFromPageLoad = 0;

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
    console.log(`created NS ${this.id} ${newVar}`);
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
      this.visMap[planet.id] = isInAABB(AABB, planet, planet.radius);
    }
    const star = this.state.locations[0].star;
    if (star) {
      this.visMap[star.id] = isInAABB(AABB, star, star.radius);
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
      this.addExtrapolateBreadcrumbs();
    } else {
      console.warn('extrapolation failed');
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
    console.log(`disconnecting NS ${this.id}`);
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
    console.log(`initializing NS ${this.id}`);
    this.connecting = true;
    Perf.start();
    this.time.setInterval(
      () => {
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
            this.forceUpdateLocalState();
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
      console.warn(`No best mark for ${markInMs}`);
      this.pauseReplay();
    }
    this.emit('change');
  };

  initReplay = async (replayId: string) => {
    console.log(`initializing replay NS ${this.id} for replay ${replayId}`);
    this.connecting = true;
    const replayJson: any = await api.downloadReplayJson(replayId);
    console.log('replay downloaded');
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
      console.log(`connecting NS ${this.id}`);
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
        console.warn('socket error');
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
    const myNextShip = this.nextIndexes.myShip;
    if (myNextShip) {
      this.state.breadcrumbs.push({
        position: Vector.fromIVector(myNextShip),
        color: 'green',
      });
    }
    this.addCurrentShipBreadcrumb('yellow');
  };

  private addCurrentShipBreadcrumb = (color: string) => {
    const myShip = findMyShip(this.state);
    if (myShip) {
      this.state.breadcrumbs.push({
        position: Vector.fromIVector(myShip),
        color,
      });
    }
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

        this.state.breadcrumbs = [];
        this.addCurrentShipBreadcrumb('red');
        const savedBreadcrumbs = this.state.breadcrumbs;

        // TODO with new interpolation approach, this needs to be corrected to timestamp-match the previous prevState

        if (Math.abs(this.desync) > FULL_DESYNC_DETECT_MS) {
          console.warn(
            'full desync detected, overriding the local state fully'
          );
          this.prevState = _.clone(parsed);
          this.state = _.clone(parsed);
        } else if (this.desync < 0) {
          // normal client-ahead-of-server
          this.prevState = this.rebaseReceivedStateToCurrentPoint(
            parsed,
            -this.desync
          );
          console.log(
            'rebased prevState millis',
            this.prevState.millis,
            'on top of',
            this.serverState.millis
          );
        } else {
          // this means that client lagged and server is ahead of it, which shouldn't be the case
          // or it's still synchronizing in the beginning
          this.prevState = this.rebaseReceivedStateToCurrentPoint(
            parsed,
            10 // magic constant to bump client a little bit ahead so it doensn't have to accept it next time
          );
          console.log(
            'accepted server state with a magic bump',
            this.prevState.millis,
            'on top of',
            this.serverState.millis
          );
        }
        this.state.breadcrumbs = savedBreadcrumbs;
        this.extrapolate();

        const toDrop = new Set();
        // noinspection JSUnusedLocalSymbols
        for (const [tag, actions, ticks] of this.pendingActions) {
          const age = Math.abs(ticks - this.state.millis);
          if (age > MAX_PENDING_TICKS) {
            console.warn(
              `dropping pending action ${tag} with age ${age}>${MAX_PENDING_TICKS}`
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
              this.state.player_actions.push(cmd);
            }
          }
        }
        this.pendingActions = this.pendingActions.filter(
          ([tag]) => !toDrop.has(tag)
        );
      } else if (messageCode === ServerToClientMessageCode.TagConfirm) {
        const confirmedTag = JSON.parse(data).tag;

        this.pendingActions = this.pendingActions.filter(
          ([tag]) => tag !== confirmedTag
        );
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
        console.log('Received disconnect request from server');
        this.disconnectAndDestroy();
      } else {
        console.log('unknown message code', messageCode);
      }
      this.reindexNetState();
    } catch (e) {
      console.warn('error handling message', e);
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
          console.warn('unsupported command');
          break;
        }
        case ClientOpCode.Unknown: {
          console.warn(`Unknown opcode ${cmd.code}`);
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
        default:
          throw new UnreachableCaseError(cmd.code);
      }
    }
  }

  // [tag, action, ticks], the order is the order of appearance
  private pendingActions: [string, Action[], number][] = [];

  forceUpdateLocalState = () => {
    const prevLastUpdate =
      this.lastUpdateTimeMsFromPageLoad || Math.floor(performance.now());
    this.lastUpdateTimeMsFromPageLoad = Math.floor(performance.now());
    const elapsedMs = this.lastUpdateTimeMsFromPageLoad - prevLastUpdate;
    if (elapsedMs <= 0) {
      return; // already actual state, beginning of game, or 'impossible' negative
    }
    this.updateLocalState(elapsedMs);
    this.prevState = _.clone(this.state);
  };

  updateLocalState = (elapsedMs: number) => {
    // block all controls in inactive game state
    if (this.state.paused) {
      resetActiveSyncActions();
      return;
    }

    const actionsToSync = getActiveSyncActions();

    // send to server immediately
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
      this.sendSchedulePlayerAction(action);
    }

    // schedule for optimistic update
    this.state.player_actions = [];
    for (const cmd of actionsToSync) {
      this.state.player_actions.push(cmd);
    }

    if (isSyncActionTypeActive('Move')) {
      this.visualState.boundCameraMovement = true;
    }

    // this.pendingActions.push(...actionsToSync);

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
      this.state.player_actions.push(act);
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
        console.log(
          `interpolation bump due to client lag, may look bad, diff=${(
            baseMs - currentMs
          ).toFixed(0)}ms`
        );
      }
    } else {
      this.state = _.clone(this.prevState);
      console.log('interpolation impossible, no valid boundaries');
    }
    this.reindexCurrentState();
  }

  private rebaseReceivedStateToCurrentPoint(
    parsed: GameState,
    adjustMillis: number
  ): GameState {
    // too much stuff here and it will slow down itself (unless I add again the instant-update mode without iterations, which is non-deterministic then)
    const MAX_ACCEPTABLE_REBASE_ADJUST = 100;
    if (adjustMillis > MAX_ACCEPTABLE_REBASE_ADJUST) {
      console.warn(
        `refusing to adjust state due to huge difference ${adjustMillis} > max=${MAX_ACCEPTABLE_REBASE_ADJUST}`
      );
      parsed.millis += adjustMillis;
      return parsed;
    }
    console.log(
      'executing rebase server state',
      parsed.millis,
      'with adjustMillis',
      adjustMillis
    );
    // return parsed;
    return (
      updateWorld(parsed, this.getSimulationArea(), adjustMillis) || parsed
    );
  }

  private controlForOuterPlanet(prevState: GameState, nextState: GameState) {
    const prevPlanet =
      prevState.locations[0].planets[prevState.locations[0].planets.length - 1];
    const nextPlanet =
      nextState.locations[0].planets[nextState.locations[0].planets.length - 1];
    const prevPos = Vector.fromIVector(prevPlanet);
    const nextPos = Vector.fromIVector(nextPlanet);
    const dist = prevPos.euDistTo(nextPos);
    const timeDist = nextState.millis - prevState.millis;
    console.log({
      dist,
      timeDist,
      prevPos: prevPos.toFix(),
      nextPos: nextPos.toFix(),
    });
  }
}
