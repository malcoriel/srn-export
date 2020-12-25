import EventEmitter from 'events';
import { GameState } from './common';

export default class NetState extends EventEmitter {
  private socket!: WebSocket;
  private state!: GameState;
  constructor() {
    super();
    this.state = { planets: [], players: [], ships: [], tick: 0 };
  }

  async forceSync() {
    this.send('sync');
  }

  async connect() {
    this.socket = new WebSocket('ws://127.0.0.1:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      console.log('message', event.data);
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.tick > this.state.tick) {
        this.state = parsed;
      }
    } catch (e) {
      console.warn('error handling message', e);
    }
  }

  send(value: string) {
    if (this.socket) {
      this.socket.send(value);
    } else {
      console.warn('socket is closed');
    }
  }
}
