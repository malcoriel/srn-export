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
import { actionsActive } from './ShipControls';

enum OpCode {
  Unknown,
  Sync,
  MutateMyShip,
  Name,
}

interface Cmd {
  code: OpCode;
  value: any;
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
  constructor() {
    super();
    this.state = {
      planets: [],
      players: [],
      ships: [],
      ticks: 0,
      my_id: '',
      // @ts-ignore
      star: null,
    };
    this.ping = 0;
    setInterval(this.forceSync, FORCE_SYNC_INTERVAL);
    setInterval(this.updateShipOnServer, SHIP_UPDATE_INTERVAL);
  }

  forceSync = () => {
    if (!this.connecting) {
      let tag = uuid.v4();
      this.forceSyncTag = tag;
      this.forceSyncStart = performance.now();
      const forcedDelay = 200;
      this.send({ code: OpCode.Sync, value: { tag, forcedDelay } });
    }
  };

  connect = () => {
    this.socket = new WebSocket('ws://192.168.0.10:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.socket.onclose = () => {
      this.emit('network');
      this.socket = null;
      this.state.ticks = 0;
      setTimeout(() => {
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
      this.emit('network');
      if (this.socket) {
        this.socket.close();
      }
    };
  };

  private handleMessage(data: string) {
    try {
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
      // 2. fix docking/undocking rollback - this is a particular case of movement rollback
      const myUpdatedShip = findMyShip(this.state);
      if (myOldShip && myUpdatedShip) {
        myUpdatedShip.docked_at = myOldShip.docked_at;
      }
      // 3. fix my movement rollback by allowing update
      if (myOldShip && myUpdatedShip) {
        myUpdatedShip.x = myOldShip.x;
        myUpdatedShip.y = myOldShip.y;
      }

      this.emit('change', this.state);
    } catch (e) {
      console.warn('error handling message', e);
    }
  }

  private handleMaxPing(parsed: GameState) {
    // This method is fairly dumb since it reset max ping
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
          let syncMsg = `${cmd.code}_%_${cmd.value.tag}`;
          if (cmd.value.forcedDelay) {
            syncMsg += `_%_${cmd.value.forcedDelay}`;
          }
          this.socket.send(syncMsg);
          break;
        }
        case OpCode.MutateMyShip: {
          this.socket.send(`${cmd.code}_%_${JSON.stringify(cmd.value)}`);
          break;
        }
        case OpCode.Name: {
          this.socket.send(`${cmd.code}_%_${cmd.value}`);
          break;
        }
      }
    }
  }

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
    if (actions[ShipActionType.Dock]) {
      this.updateShipOnServer();
    }
    let result;

    const inState = this.state;

    result = simulateStateUpdate(inState, elapsedMs);
    if (result) {
      this.state = result;
    }
  };

  private updateShipOnServer = () => {
    if (this.state && !this.state.paused) {
      let myShipIndex = findMyShipIndex(this.state);
      if (myShipIndex !== -1 && myShipIndex !== null) {
        const myShip = this.state.ships[myShipIndex];
        this.send({ code: OpCode.MutateMyShip, value: myShip });
      }
    }
  };
}
