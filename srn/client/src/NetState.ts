import EventEmitter from 'events';
import {
  applyShipAction,
  GameState,
  Ship,
  ShipAction,
  ShipActionType,
  simulateStateUpdate,
} from './world';
import * as uuid from 'uuid';
import { actionsActive, resetActions } from './utils/ShipControls';
export type Timeout = ReturnType<typeof setTimeout>;

enum OpCode {
  Unknown,
  Sync,
  MutateMyShip,
  Name,
}

interface Cmd {
  code: OpCode;
  value: any;
  tag?: string;
}

const FORCE_SYNC_INTERVAL = 1000;
const SHIP_UPDATE_INTERVAL = 200;
const RECONNECT_INTERVAL = 1000;
const MAX_PING_LIFE = 10000;

export const findMyPlayer = (state: GameState) =>
  state.players.find((player) => player.id === state.my_id);

export const findMyShipIndex = (state: GameState): number | null => {
  const myPlayer = findMyPlayer(state);
  if (!myPlayer) return null;

  const foundShipIndex = state.ships.findIndex(
    (ship) => ship.id === myPlayer.ship_id
  );
  if (foundShipIndex == -1) return null;
  return foundShipIndex;
};

export const findMyShip = (state: GameState): Ship | null => {
  const index = findMyShipIndex(state);
  if (index != -1 && index !== null) return state.ships[index];
  return null;
};

export type VisualState = {
  boundCameraMovement: boolean;
  cameraPosition: {
    x: number;
    y: number;
  };
  // proportion from default zoom
  zoomShift?: number;
};

const DEBUG_CREATION = false;

export enum ServerToClientMessageCode {
  Unknown,
  Sync,
  SyncExclusive,
  TagConfirm = 3,
}

const MAX_PENDING_TICKS = 2000;

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;
  state!: GameState;
  public connecting = true;
  public preferredName = 'player';
  public ping: number;
  public maxPing?: number;
  public maxPingTick?: number;
  public client_start_moment?: number;
  public initial_ping?: number;
  private forceSyncStart?: number;
  private forceSyncTag?: string;
  public visualState: VisualState;

  private static instance?: NetState;
  private readonly forceSyncInterval?: Timeout;
  private readonly updateOnServerInterval?: Timeout;
  private reconnectTimeout?: Timeout;
  private readonly id: string;
  private disconnecting: boolean = false;
  public static make() {
    NetState.instance = new NetState(false);
  }
  public static get(): NetState | undefined {
    // if (!NetState.instance) {
    //   NetState.instance = new NetState(false);
    // }
    return NetState.instance;
  }

  constructor(public mock: boolean) {
    super();
    this.id = uuid.v4();
    if (!mock) {
      let newVar = DEBUG_CREATION ? `at ${new Error().stack}` : '';
      console.log(`created NS ${this.id} ${newVar}`);
    }
    this.state = {
      planets: [],
      players: [],
      ships: [],
      ticks: 0,
      my_id: uuid.v4(),
      // @ts-ignore
      star: null,
      start_time_ticks: 0,
      milliseconds_remaining: 0,
      paused: false,
    };
    this.ping = 0;
    this.visualState = {
      boundCameraMovement: true,
      cameraPosition: {
        x: 0,
        y: 0,
      },
    };
    if (!mock) {
      this.forceSyncInterval = setInterval(this.forceSync, FORCE_SYNC_INTERVAL);
      this.updateOnServerInterval = setInterval(
        () => this.updateShipOnServer(uuid.v4()),
        SHIP_UPDATE_INTERVAL
      );
    }
  }

  forceSync = () => {
    if (!this.connecting) {
      let tag = uuid.v4();
      this.forceSyncTag = tag;
      this.forceSyncStart = performance.now();
      const forcedDelay = 0;
      this.send({ code: OpCode.Sync, value: { tag, forcedDelay } });
    }
  };

  disconnect = () => {
    this.disconnecting = true;
    console.log(`disconnecting NS ${this.id}`);
    if (this.socket) {
      this.socket.close();
    }
    if (this.forceSyncInterval) {
      clearInterval(this.forceSyncInterval);
    }
    if (this.updateOnServerInterval) {
      clearInterval(this.updateOnServerInterval);
    }
    if (this.reconnectTimeout) {
      clearInterval(this.reconnectTimeout);
    }
    NetState.instance = undefined;
  };
  connect = () => {
    if (this.disconnecting || this.mock) {
      return;
    }
    console.log(`connecting NS ${this.id}`);
    this.socket = new WebSocket('ws://192.168.0.10:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
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
      this.send({ code: OpCode.Name, value: this.preferredName });
    };
    this.socket.onerror = () => {
      console.warn('socket error');
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

      let messageCode = Number(messageCodeStr);
      if (
        messageCode === ServerToClientMessageCode.Sync ||
        messageCode === ServerToClientMessageCode.SyncExclusive
      ) {
        const parsed = JSON.parse(data);
        if (
          parsed.tag &&
          parsed.tag === this.forceSyncTag &&
          this.forceSyncStart
        ) {
          this.ping = Math.floor((performance.now() - this.forceSyncStart) / 2);
          this.handleMaxPing(parsed);

          this.forceSyncTag = undefined;
          this.forceSyncStart = undefined;
        }

        const myOldShip = findMyShip(this.state);
        this.state = parsed;
        // compensate for ping since the state we got is already outdated by that value
        // 1. primarily work on planets - something that is adjusted deterministically
        this.updateLocalState(this.ping);
        const myUpdatedShip = findMyShip(this.state);
        // 2. fix my movement rollback by allowing update
        if (myOldShip && myUpdatedShip) {
          myUpdatedShip.x = myOldShip.x;
          myUpdatedShip.y = myOldShip.y;
        }

        let toDrop = new Set();
        for (const [tag, actions, ticks] of this.pendingActions) {
          let age = Math.abs(ticks - this.state.ticks);
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

        if (!this.disconnecting) {
          this.emit('change', this.state);
        }
      } else if (messageCode === ServerToClientMessageCode.TagConfirm) {
        let confirmedTag = JSON.parse(data).tag;

        this.pendingActions = this.pendingActions.filter(
          ([tag]) => tag !== confirmedTag
        );
      }
    } catch (e) {
      console.warn('error handling message', e);
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
    if (this.maxPingTick == undefined) {
      this.maxPing = this.ping;
    }
  }

  private send(cmd: Cmd) {
    if (this.socket && !this.connecting) {
      switch (cmd.code) {
        case OpCode.Sync: {
          // TODO use cmd.tag instead of value tag for force-syncs
          let syncMsg = `${cmd.code}_%_${cmd.value.tag}`;
          if (cmd.value.forcedDelay) {
            syncMsg += `_%_${cmd.value.forcedDelay}`;
          }
          this.socket.send(syncMsg);
          break;
        }
        case OpCode.MutateMyShip: {
          this.socket.send(
            `${cmd.code}_%_${JSON.stringify(cmd.value)}_%_${cmd.tag}`
          );
          break;
        }
        case OpCode.Name: {
          this.socket.send(`${cmd.code}_%_${cmd.value}`);
          break;
        }
      }
    }
  }

  // [tag, action, ticks], the order is the order of appearance
  private pendingActions: [string, ShipAction[], number][] = [];

  private mutate_ship = (commands: ShipAction[], elapsedMs: number) => {
    const myShipIndex = findMyShipIndex(this.state);
    if (myShipIndex === -1 || myShipIndex === null) return;
    let myShip = this.state.ships.splice(myShipIndex, 1)[0];
    for (const cmd of commands) {
      myShip = applyShipAction(
        myShip,
        cmd,
        this.state,
        elapsedMs,
        this.maxPing || this.ping
      );
    }
    this.state.ships.push(myShip);
  };

  onPreferredNameChange = (newName: string) => {
    this.preferredName = newName;
  };

  updateLocalState = (elapsedMs: number) => {
    let actions = Object.values(actionsActive).filter((a) => !!a);
    this.mutate_ship(actions as ShipAction[], elapsedMs);
    let dockAction = actionsActive[ShipActionType.Dock];
    let navigateAction = actionsActive[ShipActionType.Navigate];
    let dockNavigateAction = actionsActive[ShipActionType.DockNavigate];
    if (dockAction || navigateAction || dockNavigateAction) {
      let tag = uuid.v4();
      const nonNullActions = [
        dockAction,
        navigateAction,
        dockNavigateAction,
      ].filter((a) => !!a) as ShipAction[];
      this.pendingActions.push([tag, nonNullActions, this.state.ticks]);
      this.updateShipOnServer(tag);
    }
    if (actionsActive[ShipActionType.Move]) {
      this.visualState.boundCameraMovement = true;
    }
    resetActions();
    let result;

    const inState = this.state;

    result = simulateStateUpdate(inState, elapsedMs);
    // let targets = this.state.ships
    //   .map((s) => s.navigate_target)
    //   .filter((n) => !!n);
    // if (targets.length > 0) {
    //   console.log('ships navigate', targets);
    // }
    if (result) {
      this.state = result;
    }
  };

  private updateShipOnServer = (tag: string) => {
    if (this.state && !this.state.paused) {
      let myShipIndex = findMyShipIndex(this.state);
      if (myShipIndex !== -1 && myShipIndex !== null) {
        const myShip = this.state.ships[myShipIndex];
        this.send({ code: OpCode.MutateMyShip, value: myShip, tag });
      }
    }
  };
}
