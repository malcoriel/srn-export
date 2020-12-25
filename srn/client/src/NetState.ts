import EventEmitter from 'events';
import { GameState } from './common';

enum OpCode {
  Unknown,
  Sync,
  Mutate,
  Name,
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
  public preferredName = 'player';
  constructor() {
    super();
    this.state = { planets: [], players: [], ships: [], tick: -1, my_id: '' };
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
        case OpCode.Mutate: {
          this.socket.send(`${cmd.code}_%_${JSON.stringify(cmd.value)}`);
          break;
        }
        case OpCode.Name: {
          this.socket.send(`${cmd.code}_%_${cmd.value}`);
          break;
        }
      }
    } else {
    }
  }

  mutate = (newState: GameState) => {
    this.state = newState;
    this.send({ code: OpCode.Mutate, value: newState });
    this.emit('change', this.state);
  };

  onPreferredNameChange = (newName: string) => {
    this.preferredName = newName;
  };
}
