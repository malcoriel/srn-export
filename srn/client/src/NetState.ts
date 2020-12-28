import EventEmitter from 'events';
import { applyShipAction, GameState, ShipAction } from './world';
import uuid from 'uuid';

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
const RECONNECT_INTERVAL = 1000;

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

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;
  state!: GameState;
  public connecting = true;
  public preferredName = 'player';
  private localSimUpdate:
    | ((serialized_state: string, elapsed_micro: BigInt) => string)
    | undefined;
  public ping: number;
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
      // noinspection JSIgnoredPromiseFromCall
      this.initLocalSim();
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
        this.forceSyncTag = undefined;
        this.forceSyncStart = undefined;
      }

      this.state = parsed;
      // compensate for ping since the state we got is already outdated by that value
      this.updateLocalState(this.ping);
      this.emit('change', this.state);
    } catch (e) {
      console.warn('error handling message', e);
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

  mutate_ship = (cmd: ShipAction) => {
    const myShipIndex = findMyShipIndex(this.state);
    if (myShipIndex === -1 || myShipIndex === null) return;
    const myShip = this.state.ships.splice(myShipIndex, 1)[0];
    const newShip = applyShipAction(myShip, cmd, this.state);
    this.state.ships.push(myShip);
    this.emit('change', this.state);
    this.send({ code: OpCode.MutateMyShip, value: newShip });
  };

  onPreferredNameChange = (newName: string) => {
    this.preferredName = newName;
  };

  private async initLocalSim() {
    const { update, set_panic_hook } = await import('../../world/pkg');
    set_panic_hook();
    this.localSimUpdate = update;
  }

  updateLocalState(elapsedMs: number) {
    if (!this.localSimUpdate) {
      return;
    }
    let updated = this.localSimUpdate(
      JSON.stringify(this.state),
      BigInt(elapsedMs * 1000)
    );
    if (updated) {
      let result = JSON.parse(updated);
      if (!result.message) {
        //console.log({ local: this.state.ticks });
        this.state = result;
      } else {
        console.warn(result.message);
      }
    } else {
      console.warn('no result from local update');
    }
  }
}
