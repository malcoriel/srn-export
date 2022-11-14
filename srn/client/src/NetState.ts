import {
  AABB,
  DEFAULT_STATE,
  GameMode,
  GameState,
  isInAABB,
  loadReplayIntoWasm,
  ManualMovementActionTags,
  rawUpdateWorld,
  restoreReplayFrame,
  TradeAction,
  updateWorld,
} from './world';
import EventEmitter from 'events';
import * as uuid from 'uuid';
import Vector, { IVector } from './utils/Vector';
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
import { StateSyncer } from './StateSyncer';
import {
  getActiveSyncActions,
  resetActiveSyncActions,
} from './utils/ShipControls';

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
export const DISPLAY_BREADCRUMBS_LAST_TICKS = 10 * 1000 * 1000; // 10s

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;

  // actual state used for rendering = interpolate(prevState, nextState, value=0..1)
  state!: GameState;

  syncer: StateSyncer;

  // last calculated state, either result of local actions,
  // updated by timer
  prevState!: GameState;

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

  public debugSpaceTime = false;

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
    this.syncer = new StateSyncer({
      wasmUpdateWorld: updateWorld,
    });
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
      (_elapsedMs: number) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          // do nothing, everything happens in render
        });
      },
      (elapsedMs) => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;
          const elapsedTicks = Math.round(elapsedMs * 1000);
          const actionsActive = getActiveSyncActions();
          const visibleArea = this.getSimulationArea();
          this.applyCurrentPlayerActions(actionsActive, visibleArea);
          this.syncer.handle({
            tag: 'time update',
            elapsedTicks,
            visibleArea,
          }); // ignore errors from syncer for now
          this.state = this.syncer.getCurrentState() || this.state;
          if (this.debugSpaceTime) {
            this.addSpaceTimeBreadcrumbs();
          }
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
          // const syncerLogEntries = this.syncer.flushLog();
          // if (syncerLogEntries.length > 0) {
          //   for (const entry of syncerLogEntries) {
          //     console.log(entry);
          //   }
          //   console.log('---');
          // }
          this.cleanupBreadcrumbs();
        });
      },
      () => {}
    );
    return this.connect();
  };

  private applyCurrentPlayerActions(
    actionsActive: Action[],
    visibleArea: AABB
  ) {
    if (actionsActive.length <= 0) {
      return;
    }
    const packetTag = uuid.v4();
    this.syncer.handle({
      tag: 'player action',
      actions: actionsActive,
      packetTag,
      visibleArea,
    });
    if (this.debugSpaceTime) {
      const myShip = findMyShip(this.state);
      if (myShip) {
        this.visualState.breadcrumbs.push({
          tag: 'spaceTime',
          timestamp_ticks: this.state.ticks,
          position: Vector.fromIVector(myShip),
          color: 'orange',
        });
      }
    }
    resetActiveSyncActions();
    this.sendSchedulePlayerActionBatch(actionsActive, packetTag);
  }

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

  private addSpaceTimeBreadcrumbs = () => {
    const SPACING_TICKS = 50 * 1000;
    // @ts-ignore
    const lastBreadcrumb = this.visualState.breadcrumbs.findLast(
      (b: Breadcrumb | BreadcrumbLine) => b.tag === 'spaceTime'
    );
    if (
      lastBreadcrumb &&
      Math.abs(this.state.ticks - lastBreadcrumb.timestamp_ticks) <=
        SPACING_TICKS
    ) {
      // console.log('skip', this.state.ticks - lastBreadcrumb.timestamp_ticks);
      return;
    }
    const SPACE_TIME_SHIFT_SPEED = 5 / 1000 / 1000;
    this.visualState.breadcrumbs = this.visualState.breadcrumbs.map((b) => {
      if (b.tag !== 'spaceTime') {
        return b;
      }
      b.position.x -= SPACING_TICKS * SPACE_TIME_SHIFT_SPEED;
      return b;
    });
    const myShip = findMyShip(this.state);
    if (myShip) {
      this.visualState.breadcrumbs.push({
        position: Vector.fromIVector(myShip),
        color: myShip.navigate_target ? 'green' : 'pink',
        timestamp_ticks: this.state.ticks,
        tag: 'spaceTime',
      });
    }
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
        this.syncer.handle({
          tag: 'server state',
          state: parsed,
          visibleArea: this.getSimulationArea(),
        });
        this.state = this.syncer.getCurrentState();
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
      } else if (messageCode === ServerToClientMessageCode.TagConfirm) {
        // nothing for now
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

  public sendSchedulePlayerActionBatch(actions: Action[], tag: string) {
    this.send({
      code: ClientOpCode.SchedulePlayerActionBatch,
      value: { actions },
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
        player_id: this.state?.my_id,
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
}
