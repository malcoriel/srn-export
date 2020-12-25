import EventEmitter from 'events';
import { GameState } from './common';

export default class NetState extends EventEmitter {
  private socket!: WebSocket;
  state!: GameState;
  constructor() {
    super();
    this.state = { planets: [], players: [], ships: [], tick: -1 };
  }

  // forceSync() {
  //   console.log('forcing sync');
  //   this.send('sync');
  // }

  connect() {
    this.socket = new WebSocket('ws://127.0.0.1:2794', 'rust-websocket');
    this.socket.onmessage = (event) => {
      console.log('message', event.data);
      this.handleMessage(event.data);
    };
    // this.socket.onopen = () => this.forceSync();
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

  send(value: string) {
    if (this.socket) {
      this.socket.send(value);
    } else {
      console.warn('socket is closed');
    }
  }

  mutate = (newState: GameState) => {
    this.state = newState;
    this.emit('change', this.state);
  };
}
