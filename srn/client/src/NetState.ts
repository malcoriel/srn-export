import {
  AABB,
  applyShipActionWasm,
  Dialogue,
  GameMode,
  GameState,
  isManualMovement,
  loadReplayIntoWasm,
  ManualMovementActionTags,
  restoreReplayFrame,
  SandboxCommand,
  TradeAction,
  updateWorld,
} from './world';
import EventEmitter from 'events';
import * as uuid from 'uuid';
import { actionsActive, resetActions } from './utils/ShipControls';
import Vector, { IVector } from './utils/Vector';
import { Measure, Perf, statsHeap } from './HtmlLayers/Perf';
import { vsyncedCoupledThrottledTime, vsyncedCoupledTime } from './utils/Times';
import { api } from './utils/api';
import { viewPortSizeMeters } from './coord';
import _ from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import {
  InventoryAction,
  LongActionStart,
  NotificationAction,
  PlayerActionRust,
} from '../../world/pkg';
import {
  buildClientStateIndexes,
  ClientStateIndexes,
  findMyShip,
  findMyShipIndex,
} from './ClientStateIndexing';
import { PlayerActionRustBuilder } from '../../world/pkg/world.extra';
export type Timeout = ReturnType<typeof setTimeout>;

module?.hot?.dispose(() => {
  // for some reason CRA's client doesn't reload the page itself on hot.decline
  window.location.reload();
});

enum ClientOpCode {
  Unknown,
  Sync,
  MutateMyShip,
  Name,
  DialogueOption,
  SwitchRoom,
  SandboxCommand,
  TradeAction,
  DialogueRequest,
  InventoryAction,
  LongActionStart,
  RoomJoin,
  NotificationAction,
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

const MAX_PENDING_TICKS = 2000;
// it's completely ignored in actual render, since vsynced time is used
const LOCAL_SIM_TIME_STEP = Math.floor(1000 / 30);
const SLOW_TIME_STEP = Math.floor(1000 / 8);
statsHeap.timeStep = LOCAL_SIM_TIME_STEP;
const MAX_ALLOWED_DIST_DESYNC = 5.0;
// this has to be less than expiry (500ms) minus ping
const MANUAL_MOVEMENT_SYNC_INTERVAL_MS = 200;

const serializeSandboxCommand = (cmd: SandboxCommand) => {
  // if (typeof cmd === 'string') return cmd;
  return JSON.stringify(cmd);
};

export const reindexNetState = (netState: NetState) => {
  netState.indexes = buildClientStateIndexes(netState.state);
};

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;

  state!: GameState;

  indexes!: ClientStateIndexes;

  dialogue?: Dialogue;

  lastDialogue?: Dialogue;

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

  private mode!: GameMode;

  private switchingRooms = false;

  public replay: any;

  public playingReplay = false;

  public static make() {
    NetState.instance = new NetState();
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

  private resetState() {
    this.state = {
      ticks: 0,
      gen_opts: {
        system_count: 0,
        max_planets_in_system: 10,
        max_satellites_for_planet: 3,
      },
      disable_hp_effects: false,
      id: '',
      leaderboard: {
        rating: [],
        winner: '',
      },
      market: {
        prices: {},
        wares: {},
        time_before_next_shake: 0,
      },
      mode: GameMode.Unknown,
      seed: '',
      tag: '',
      version: 0,
      locations: [
        {
          id: '',
          seed: '',
          planets: [],
          minerals: [],
          containers: [],
          asteroids: [],
          asteroid_belts: [],
          ships: [],
          adjacent_location_ids: [],
          star: null,
          position: new Vector(0, 0),
          wrecks: [],
        },
      ],
      players: [],
      millis: 0,
      my_id: uuid.v4(),
      start_time_ticks: 0,
      milliseconds_remaining: 0,
      paused: true,
      interval_data: {},
      game_over: null,
      events: [],
      processed_events: [],
      player_actions: [],
      processed_player_actions: [],
      update_every_ticks: 9999,
      accumulated_not_updated_ticks: 0,
      ship_history: {},
    };
    reindexNetState(this);
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

  init = (mode: GameMode) => {
    this.mode = mode;
    console.log(`initializing NS ${this.id}`);
    this.connecting = true;
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
          if (this.switchingRooms) {
            return;
          }
          ns.updateLocalState(Math.floor((elapsedMs * 1000) / 1000));
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
    this.connect();
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
        reindexNetState(this);
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

  connect = () => {
    if (this.disconnecting) {
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
  };

  public sendName() {
    this.send({
      code: ClientOpCode.Name,
      value: JSON.stringify({
        name: this.playerName,
        portrait_name: this.portraitName,
      }),
    });
  }

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
        this.sendName();
      }

      if (
        messageCode === ServerToClientMessageCode.ObsoleteStateBroadcast ||
        messageCode ===
          ServerToClientMessageCode.ObsoleteStateChangeExclusive ||
        messageCode === ServerToClientMessageCode.XCastGameState
      ) {
        const parsed = JSON.parse(data);
        // // 1. try to deal with out-of-order packets by rejecting
        // // the ones that are older than already received ones
        // // 2. However, when the state resets and ticks go back to 0,
        // // this protection will lead to a freeze. Hence, that check for big diff
        // if (
        //   parsed.millis < this.lastReceivedServerTicks &&
        //
        // ) {
        //   console.log(
        //     'drop out-of-order xcast_state',
        //     parsed.millis,
        //     this.lastReceivedServerTicks
        //   );
        //   return;
        // }
        this.lastReceivedServerTicks = parsed.millis;

        this.desync = parsed.millis - this.state.millis;

        const myOldShip = findMyShip(this.state);
        // the client should only hanlde its own player actions,
        // and the server will not send any anyway
        const oldPlayerActions = this.state.player_actions;
        this.state = parsed;
        this.state.player_actions = oldPlayerActions;
        // compensate for ping since the state we got is already outdated by that value
        // 1. primarily work on planets - something that is adjusted deterministically
        this.updateLocalState(this.ping);
        const myUpdatedShip = findMyShip(this.state);
        // 2. fix my movement rollback by allowing update. However, too much desync
        // is dangerous, so cap it.
        if (
          myOldShip &&
          myUpdatedShip &&
          Vector.fromIVector(myOldShip).euDistTo(
            Vector.fromIVector(myUpdatedShip)
          ) <= MAX_ALLOWED_DIST_DESYNC
        ) {
          myUpdatedShip.x = myOldShip.x;
          myUpdatedShip.y = myOldShip.y;
        }
        // 3. Erase server-side trajectory to remove annoying small glitched view
        if (myUpdatedShip && myOldShip) {
          myUpdatedShip.trajectory = myOldShip.trajectory;
        }

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
            this.mutateShip(actions);
          }
        }
        this.pendingActions = this.pendingActions.filter(
          ([tag]) => !toDrop.has(tag)
        );

        // Sync updates on socket messages lead to big slowdown
        // if (!this.disconnecting) {
        //   this.emit('change', this.state);
        // }
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
      } else if (
        messageCode === ServerToClientMessageCode.UnicastDialogueStateChange
      ) {
        this.dialogue = JSON.parse(data).value;
        this.emit('dialogue');
      } else if (messageCode === ServerToClientMessageCode.XCastGameEvent) {
        const event = JSON.parse(data).value;
        this.emit('gameEvent', event);
      } else if (messageCode === ServerToClientMessageCode.LeaveRoom) {
        console.log('Received disconnect request from server');
        this.disconnectAndDestroy();
      }
      reindexNetState(this);
    } catch (e) {
      console.warn('error handling message', e);
    } finally {
      this.updateVisMap();
    }
  }

  private send(cmd: Cmd) {
    if (this.socket && !this.connecting) {
      switch (cmd.code) {
        case ClientOpCode.Unknown: {
          console.warn(`Unknown opcode ${cmd.code}`);
          break;
        }
        case ClientOpCode.Sync: {
          console.warn('unsupported command');
          break;
        }
        case ClientOpCode.MutateMyShip: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.Name: {
          this.socket.send(`${cmd.code}_%_${cmd.value}`);
          break;
        }
        case ClientOpCode.DialogueOption: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.SwitchRoom: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.SandboxCommand: {
          this.socket.send(`${cmd.code}_%_${cmd.value}_%_${cmd.tag}`);
          break;
        }
        case ClientOpCode.TradeAction: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.DialogueRequest: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.InventoryAction: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.LongActionStart: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.NotificationAction: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case ClientOpCode.RoomJoin: {
          this.socket.send(`${cmd.code}_%_noop`);
          break;
        }
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
  private pendingActions: [string, PlayerActionRust[], number][] = [];

  private mutateShip = (commands: PlayerActionRust[]) => {
    const myShipIndex = findMyShipIndex(this.state);
    if (myShipIndex === -1 || myShipIndex === null) return;
    let myShip = this.state.locations[0].ships[myShipIndex];
    for (const cmd of commands) {
      if (this.isWorldUpdatePlayerAction(cmd)) {
        this.state.player_actions.push(cmd);
      } else {
        const res = applyShipActionWasm(this.state, cmd);
        if (res) {
          myShip = res;
        }
      }
    }
    this.state.locations[0].ships.splice(myShipIndex, 1);
    this.state.locations[0].ships.push(myShip);
    reindexNetState(this);
  };

  onPreferredNameChange = (newName: string) => {
    this.playerName = newName;
  };

  updateLocalState = (elapsedMs: number) => {
    if (this.state.paused) {
      resetActions();
      return;
    }

    const actions = Object.values(actionsActive).filter((a) => !!a);
    const actionsToSync = actions.filter((a) => !!a) as PlayerActionRust[];

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
      const tag = uuid.v4();
      if (!this.isWorldUpdatePlayerAction(action)) {
        this.pendingActions.push([tag, [action], this.state.millis]);
      }
      this.updateShipOnServer(tag, action);
    }

    this.mutateShip(actions as PlayerActionRust[]);

    if (actionsActive.Move) {
      this.visualState.boundCameraMovement = true;
    }
    resetActions();

    const simArea = this.getSimulationArea();
    const result = updateWorld(this.state, simArea, elapsedMs);
    if (result) {
      this.state = result;
      reindexNetState(this);
      this.updateVisMap();
    }
  };

  private isWorldUpdatePlayerAction(action: PlayerActionRust) {
    if (
      action.tag === 'Gas' ||
      action.tag === 'StopGas' ||
      action.tag === 'TurnRight' ||
      action.tag === 'TurnLeft' ||
      action.tag === 'StopTurn' ||
      action.tag === 'Reverse'
    )
      return true;
    return false;
  }

  private updateShipOnServer = (tag: string, action: PlayerActionRust) => {
    if (this.state && !this.state.paused) {
      if (!this.isWorldUpdatePlayerAction(action)) {
        this.send({
          code: ClientOpCode.MutateMyShip,
          value: action,
          tag,
        });
      } else {
        this.sendSchedulePlayerAction(action);
      }
    }
  };

  public sendDialogueOption(dialogueId: string, optionId: string) {
    const tag = uuid.v4();
    this.send({
      code: ClientOpCode.DialogueOption,
      value: { dialogue_id: dialogueId, option_id: optionId },
      tag,
    });
  }

  private sendSchedulePlayerAction(action: PlayerActionRust) {
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
    this.send({
      code: ClientOpCode.SandboxCommand,
      value: serializeSandboxCommand(cmd),
      tag: uuid.v4(),
    });
  }

  public sendTradeAction(cmd: TradeAction) {
    this.send({
      code: ClientOpCode.TradeAction,
      value: cmd,
      tag: uuid.v4(),
    });
  }

  public sendDialogueRequest(planet_id: string) {
    this.send({
      code: ClientOpCode.DialogueRequest,
      value: {
        planet_id,
      },
      tag: uuid.v4(),
    });
  }

  public sendInventoryAction(invAct: InventoryAction) {
    this.send({
      code: ClientOpCode.InventoryAction,
      value: invAct,
      tag: uuid.v4(),
    });
  }

  public startLongAction(longAction: LongActionStart) {
    if (longAction.tag !== 'Shoot') {
      this.send({
        code: ClientOpCode.LongActionStart,
        value: longAction,
        tag: uuid.v4(),
      });
    } else {
      const act = PlayerActionRustBuilder.PlayerActionRustLongActionStart({
        long_action_start: longAction,
        player_id: this.state.my_id,
      });
      this.state.player_actions.push(act);
      this.sendSchedulePlayerAction(act);
    }
  }

  public sendNotificationAction(notAction: NotificationAction) {
    this.send({
      code: ClientOpCode.NotificationAction,
      value: notAction,
      tag: uuid.v4(),
    });
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
}
