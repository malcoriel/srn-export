import EventEmitter from 'events';
import { GameState } from './common';

enum OpCode {
  Unknown,
  Sync,
  Mutate,
}

interface Cmd {
  code: OpCode;
  value: any;
}

const FORCE_SYNC_INTERVAL = 10000;
const RECONNECT_INTERVAL = 1000;

export default class NetState extends EventEmitter {
  private socket: WebSocket | null = null;
  state!: GameState;
  public connecting = true;
  constructor() {
    super();
    this.state = { planets: [], players: [], ships: [], tick: -1 };
    setInterval(this.forceSync, FORCE_SYNC_INTERVAL);
  }

  forceSync = () => {
    if (!this.connecting) {
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
      this.state.tick = -1;
      setTimeout(() => {
        this.connecting = true;
        this.connect();
      }, RECONNECT_INTERVAL);
    };
    this.socket.onopen = () => {
      this.connecting = false;
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
      this.socket.send(`${cmd.code}_%_${JSON.stringify(cmd.value)}`);
    } else {
    }
  }

  mutate = (newState: GameState) => {
    this.state = newState;
    this.send({ code: OpCode.Mutate, value: newState });
    this.emit('change', this.state);
  };
}
