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

export default class NetState extends EventEmitter {
  private socket!: WebSocket;
  state!: GameState;
  constructor() {
    super();
    this.state = { planets: [], players: [], ships: [], tick: -1 };
    // @ts-ignore
    window.forceSync = this.forceSync;
  }

  forceSync = () => {
    console.log('forcing sync');
    this.send({ code: OpCode.Sync, value: null });
  };

  connect() {
    this.socket = new WebSocket('ws://127.0.0.1:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

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
    if (this.socket) {
      this.socket.send(`${cmd.code}_%_${JSON.stringify(cmd.value)}`);
    } else {
      console.warn('socket is closed');
    }
  }

  mutate = (newState: GameState) => {
    this.state = newState;
    this.send({ code: OpCode.Mutate, value: newState });
    this.emit('change', this.state);
  };
}
