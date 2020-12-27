import EventEmitter from 'events';
import { GameState, Ship } from './world';
import { ShipChanger } from './ShipControls';

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

const findMyPlayer = (state: GameState) =>
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
  constructor() {
    super();
    this.state = {
      planets: [],
      players: [],
      ships: [],
      tick: 0,
      my_id: '',
      // @ts-ignore
      star: null,
    };
    setInterval(this.forceSync, FORCE_SYNC_INTERVAL);
  }

  forceSync = () => {
    if (!this.connecting) {
      this.state.tick = 0;
      this.send({ code: OpCode.Sync, value: null });
    }
  };

  connect = () => {
    this.socket = new WebSocket('ws://127.0.0.1:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.socket.onclose = () => {
      this.emit('network');
      this.socket = null;
      this.state.tick = 0;
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
      if (parsed.tick > this.state.tick) {
        this.state = parsed;
        this.emit('change', this.state);
      }
    } catch (e) {
      console.warn('error handling message', e);
    }
  }

  private send(cmd: Cmd) {
    if (this.socket && !this.connecting) {
      switch (cmd.code) {
        case OpCode.Sync: {
          this.socket.send(`${cmd.code}_%_`);
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

  mutate_ship = (changer: ShipChanger) => {
    const myShipIndex = findMyShipIndex(this.state);
    if (myShipIndex === -1 || myShipIndex === null) return;
    const myShip = this.state.ships.splice(myShipIndex, 1)[0];
    const newShip = changer(myShip);
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
        this.state = result;
      } else {
        console.warn(result.message);
      }
    }
  }
}
