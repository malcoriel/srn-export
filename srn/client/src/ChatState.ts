import { EventEmitter } from 'events';
import * as uuid from 'uuid';
import { api } from './utils/api';
import { ChatMessage } from './HtmlLayers/GlobalChat';

export class ChatState extends EventEmitter {
  private socket?: WebSocket;
  public id: string;
  public connected: boolean;
  public messages: ChatMessage[];

  private static instance?: ChatState;
  public static get() : ChatState | undefined {
    return ChatState.instance;
  }

  public static make() {
    ChatState.instance = new ChatState();
  }



  constructor() {
    super();
    this.id = uuid.v4();
    console.log(`created CS ${this.id}`);
    this.connected = false;
    this.messages = [{name:"Client", message: "Connecting to the chat..."}];
  }

  tryConnect() {
    if (this.connected)
      return;
    this.connect();
  }

  connect() {
    console.log(`attempting to connect chat ${this.id}...`);
    this.socket = new WebSocket(api.getChatWebSocketUrl(), 'rust-websocket');
    this.socket.onmessage = (message) => {
      try {
        const parsedMsg = JSON.parse(message.data);
        this.messages.push(parsedMsg);
        this.emit('message', this.messages);
      } catch (e) {
        console.warn(e);
      }

    };
    this.socket.onopen = () => {
      this.connected = true;
      this.emit('message', this.messages);
    };
    this.socket.onerror = (err) => {
      console.warn('error connecting chat', err);
      this.messages.push({name: "Client", message: "Disconnected from the chat"});
      this.emit('message', this.messages);
      this.connected = false;
      this.tryDisconnect();
    };
  }

  send(message: ChatMessage) {
    if (!this.socket)
      return;
    this.socket.send(JSON.stringify(message));
  }

  tryDisconnect() {
    console.log(`disconnecting chat ${this.id}...`);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      this.connected = false;
    }
  }
}
