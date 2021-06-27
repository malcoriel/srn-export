import EventEmitter from 'events';
import {
  AABB,
  applyShipAction,
  Dialogue,
  GameMode,
  GameState,
  SandboxCommand,
  Ship,
  ShipAction,
  ShipActionType,
  TradeAction,
  updateWorld,
} from './world';
import * as uuid from 'uuid';
import { actionsActive, resetActions } from './utils/ShipControls';
import Vector, { IVector } from './utils/Vector';
import { Measure, Perf, statsHeap } from './HtmlLayers/Perf';
import { vsyncedCoupledThrottledTime, vsyncedCoupledTime } from './utils/Times';
import { api } from './utils/api';
import { useEffect, useState } from 'react';
import { viewPortSizeMeters } from './coord';
import _ from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import {
  InventoryAction,
  LongActionStart,
  NotificationAction,
} from '../../world/pkg';

export type Timeout = ReturnType<typeof setTimeout>;

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
}

interface Cmd {
  code: ClientOpCode;
  value: any;
  tag?: string;
}

const AREA_BUFF_TO_COVER_SIZE = 1.5;
const MANUAL_MOVE_SHIP_UPDATE_INTERVAL = 50;
const RECONNECT_INTERVAL = 1000;
const MAX_PING_LIFE = 10000;

export const findMyPlayer = (state: GameState) =>
  state.players.find((player) => player.id === state.my_id);

export const findMyShipIndex = (state: GameState): number | null => {
  const myPlayer = findMyPlayer(state);
  if (!myPlayer) return null;

  const foundShipIndex = state.locations[0].ships.findIndex(
    (ship) => ship.id === myPlayer.ship_id
  );
  if (foundShipIndex === -1) return null;
  return foundShipIndex;
};

export const findMyShip = (state: GameState): Ship | null => {
  const index = findMyShipIndex(state);
  if (index !== -1 && index !== null) return state.locations[0].ships[index];
  return null;
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

const serializeSandboxCommand = (cmd: SandboxCommand) => {
  // if (typeof cmd === 'string') return cmd;
  return JSON.stringify(cmd);
};

export interface NetStateIndexes {
  myShip: Ship | null;
}

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;

  state!: GameState;

  indexes!: NetStateIndexes;

  dialogue?: Dialogue;

  lastDialogue?: Dialogue;

  public connecting = true;

  public playerName = 'player';

  public portraitName = '1';

  public ping: number;

  public maxPing?: number;

  public maxPingTick?: number;

  public visualState: VisualState;

  private static instance?: NetState;

  private updateOnServerInterval?: Timeout;

  private reconnectTimeout?: Timeout;

  readonly id: string;

  disconnecting = false;

  private lastShipPos?: Vector;

  private slowTime: vsyncedCoupledThrottledTime;

  public desync: number;

  public lastReceivedServerTicks: number;

  private lastSlowChangedState!: GameState;

  private mode!: GameMode;

  private switchingRooms = false;

  public static make() {
    NetState.instance = new NetState();
  }

  public static get(): NetState | undefined {
    // if (!NetState.instance) {
    //   NetState.instance = new NetState(false);
    // }
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
      mode: undefined,
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
        },
      ],
      players: [],
      ticks: 0,
      my_id: uuid.v4(),
      start_time_ticks: 0,
      milliseconds_remaining: 0,
      paused: true,
    };
    this.reindex();
  }

  private reindex() {
    this.indexes = {
      myShip: null,
    };
    this.indexes.myShip = findMyShip(this.state);
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
    this.updateOnServerInterval = setInterval(
      () => this.updateShipOnServerManualMove(uuid.v4()),
      MANUAL_MOVE_SHIP_UPDATE_INTERVAL
    );
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
      this.state.ticks = 0;
      this.reconnectTimeout = setTimeout(() => {
        this.connecting = true;
        this.connect();
      }, RECONNECT_INTERVAL);
    };
    this.socket.onopen = () => {
      this.connecting = false;
      this.visualState.boundCameraMovement = true;
      this.send({
        code: ClientOpCode.Name,
        value: JSON.stringify({
          name: this.playerName,
          portrait_name: this.portraitName,
        }),
      });
      if (this.mode === GameMode.Tutorial || this.mode === GameMode.Sandbox) {
        const switchRoomTag = uuid.v4();
        this.switchingRooms = true;
        this.send({
          code: ClientOpCode.SwitchRoom,
          value: { mode: GameMode[this.mode] },
          tag: switchRoomTag,
        });
      }
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
      }

      if (
        messageCode === ServerToClientMessageCode.ObsoleteStateBroadcast ||
        messageCode ===
          ServerToClientMessageCode.ObsoleteStateChangeExclusive ||
        messageCode === ServerToClientMessageCode.XCastGameState
      ) {
        const parsed = JSON.parse(data);
        // 1. try to deal with out-of-order packets by rejecting
        // the ones that are older than already received ones
        // 2. However, when the state resets and ticks go back to 0,
        // this protection will lead to a freeze. Hence, that check for big diff
        if (
          parsed.ticks < this.lastReceivedServerTicks &&
          Math.abs(parsed.ticks - this.lastReceivedServerTicks) < 100000
        ) {
          console.log(
            'drop out-of-order xcast_state',
            parsed.ticks,
            this.lastReceivedServerTicks
          );
          return;
        }
        this.lastReceivedServerTicks = parsed.ticks;

        this.desync = parsed.ticks - this.state.ticks;

        const myOldShip = findMyShip(this.state);
        this.state = parsed;
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
        for (const [tag, actions, ticks] of this.pendingActions) {
          const age = Math.abs(ticks - this.state.ticks);
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
            this.mutate_ship(actions, this.ping);
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
            (s) => {
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
      this.reindex();
    } catch (e) {
      console.warn('error handling message', e);
    } finally {
      this.updateVisMap();
    }
  }

  private handleMaxPing(parsed: GameState) {
    // This method is fairly dumb since it resets max ping
    // Instead, it could use a sliding window of pings over last X seconds
    if (
      this.maxPingTick !== undefined &&
      this.maxPingTick + MAX_PING_LIFE < parsed.ticks
    ) {
      this.maxPingTick = undefined;
    }
    if (this.maxPing !== undefined && this.ping > this.maxPing) {
      this.maxPingTick = parsed.ticks;
      this.maxPing = this.ping;
    }
    if (this.maxPingTick === undefined) {
      this.maxPing = this.ping;
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
          this.socket.send(`${cmd.code}_%_${cmd.value}_%_${cmd.tag}`);
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
        default:
          throw new UnreachableCaseError(cmd.code);
      }
    }
  }

  // [tag, action, ticks], the order is the order of appearance
  private pendingActions: [string, ShipAction[], number][] = [];

  private mutate_ship = (commands: ShipAction[], elapsedMs: number) => {
    const myShipIndex = findMyShipIndex(this.state);
    const simArea = this.getSimulationArea();
    if (myShipIndex === -1 || myShipIndex === null) return;
    let myShip = this.state.locations[0].ships[myShipIndex];
    for (const cmd of commands) {
      myShip = applyShipAction(
        myShip,
        cmd,
        this.state,
        elapsedMs,
        this.maxPing || this.ping,
        simArea
      );
    }
    this.state.locations[0].ships.splice(myShipIndex, 1);
    this.state.locations[0].ships.push(myShip);
    this.reindex();
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
    this.mutate_ship(actions as ShipAction[], elapsedMs);
    const dockAction = actionsActive[ShipActionType.Dock];
    const navigateAction = actionsActive[ShipActionType.Navigate];
    const dockNavigateAction = actionsActive[ShipActionType.DockNavigate];
    const tractorAction = actionsActive[ShipActionType.Tractor];
    const nonNullActions = [
      dockAction,
      navigateAction,
      dockNavigateAction,
      tractorAction,
    ].filter((a) => !!a) as ShipAction[];

    for (const action of nonNullActions) {
      const tag = uuid.v4();
      this.pendingActions.push([tag, [action], this.state.ticks]);
      this.updateShipOnServer(tag, action);
    }

    if (actionsActive[ShipActionType.Move]) {
      this.visualState.boundCameraMovement = true;
    }
    resetActions();

    const simArea = this.getSimulationArea();
    const result = updateWorld(this.state, simArea, elapsedMs);
    if (result) {
      this.state = result;
      this.reindex();
      this.updateVisMap();
    }
  };

  private updateShipOnServer = (tag: string, action: ShipAction) => {
    if (this.state && !this.state.paused) {
      this.send({
        code: ClientOpCode.MutateMyShip,
        value: action.serialize(),
        tag,
      });
    }
  };

  private updateShipOnServerManualMove = (tag: string) => {
    if (this.state && !this.state.paused) {
      const myShipIndex = findMyShipIndex(this.state);
      if (myShipIndex !== -1 && myShipIndex !== null) {
        const myShip = this.state.locations[0].ships[myShipIndex];
        const currentShipPos = Vector.fromIVector(myShip);
        if (
          !Vector.equals(this.lastShipPos, currentShipPos) &&
          !myShip.navigate_target &&
          !myShip.dock_target &&
          !myShip.docked_at
        ) {
          this.send({
            code: ClientOpCode.MutateMyShip,
            value: JSON.stringify({
              s_type: ShipActionType.Move,
              data: JSON.stringify({
                position: currentShipPos,
                rotation: myShip.rotation,
              }),
            }),
            tag,
          });
        }
        this.lastShipPos = currentShipPos;
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
    this.send({
      code: ClientOpCode.LongActionStart,
      value: longAction,
      tag: uuid.v4(),
    });
  }

  public sendNotificationAction(notAction: NotificationAction) {
    this.send({
      code: ClientOpCode.NotificationAction,
      value: notAction,
      tag: uuid.v4(),
    });
  }

  public sendRoomJoin() {
    this.send({
      code: ClientOpCode.RoomJoin,
      value: undefined,
      tag: undefined,
    });
  }
}

export type ShouldUpdateStateChecker = (
  prev: GameState,
  next: GameState
) => boolean;

export const useNSForceChange = (
  name: string,
  fast = false,
  shouldUpdate: ShouldUpdateStateChecker = () => true,
  throttle?: number
): NetState | null => {
  const [, forceChange] = useState(false);
  const ns = NetState.get();
  if (!ns) return null;
  useEffect(() => {
    let listener = (prevState: GameState, nextState: GameState) => {
      if (
        prevState &&
        nextState &&
        // @ts-ignore
        shouldUpdate
      ) {
        if (shouldUpdate(prevState, nextState)) {
          forceChange((flip) => !flip);
        }
      } else {
        forceChange((flip) => !flip);
      }
    };
    if (throttle) {
      listener = _.throttle(listener, throttle);
    }
    const event = fast ? 'change' : 'slowchange';
    ns.on(event, listener);
    return () => {
      ns.off(event, listener);
    };
  }, [ns.id, fast, ns, shouldUpdate, throttle]);
  return ns;
};
