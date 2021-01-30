import React, { useEffect, useState } from 'react';
import './GlobalChat.scss';
import { Input } from './ui/Input';
import { Scrollbars } from 'rc-scrollbars';
import { api } from '../utils/api';
import * as uuid from 'uuid';
import { EventEmitter } from 'events';

class ChatState extends EventEmitter {
  private socket?: WebSocket;
  public id: string;
  public connected: boolean;
  public messages: string[];
  constructor() {
    super();
    this.id = uuid.v4();
    this.connected = false;
    this.messages = [];
  }

  connect() {
    this.socket = new WebSocket(api.getWebSocketUrl(), 'rust-websocket');
    this.socket.onmessage = (message) => {
      this.messages.push(message.data);
      this.emit('message', this.messages)
    }
    this.socket.onopen = () => {
      this.connected = true;
      this.messages = ["You have been connected to the global chat."];
      this.emit('message', this.messages);
    }
    this.socket.onerror = (err) => {
      console.warn('error connecting chat', err);
      this.connected = false;
      this.disconnect();
    }
  }

  send(name: string, message: string) {
    if (!this.socket)
      return;
    this.socket.send(JSON.stringify({name, message}));
  }

  disconnect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      this.connected = false;
    }
  }
}

export const GlobalChat: React.FC = () => {
  const [messages, setMessages] = useState(['789', '789', '789', '789']);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  useEffect(() => {
    let cs = new ChatState();
    setChatState(cs);
    cs.connect();
    cs.on("message", setMessages);
    setMessages(["connecting chat..."]);
    return () => {
      if (chatState) {
        chatState.disconnect();
      }
    }
  }, [chatState]);
  const [message, setMessage] = useState('');
  let chatIsReady = chatState && chatState.connected;
  const send = () => {
    if (!(chatState && chatState.connected)) {
      return;
    }
    chatState.send("test", message);
    setMessages(m => [...m, message]);
    setMessage("");
  }
  return <div className='global-chat'>
    <div className='chat-container'>
      <Scrollbars
        renderThumbHorizontal={(props) => <div {...props} className='thumb' />}
        renderThumbVertical={(props) => <div {...props} className='thumb' />}
        style={{ width: '100%', height: '100%' }}>
        <div className='chat'>
          {messages.map((m, i) => <div className='line' key={i}>{m}</div>)}
        </div>
      </Scrollbars>
    </div>
    <div className='chat-input-container' onKeyDown={(ev: any) => {
      if (ev.code === 'Enter') {
        send();
      }
    }}>
      <Input disabled={!chatIsReady} className='chat-input' placeholder={chatIsReady ? 'say something in chat...': undefined} value={message}
             onChange={(val) => setMessage(val.target.value)} />
    </div>
  </div>;
};
