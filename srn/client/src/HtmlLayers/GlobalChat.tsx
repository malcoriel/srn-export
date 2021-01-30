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
  public messages: ChatMessage[];
  constructor() {
    super();
    this.id = uuid.v4();
    this.connected = false;
    this.messages = [];
  }

  connect() {
    console.log('attempting to connect chat...');
    this.socket = new WebSocket(api.getChatWebSocketUrl(), 'rust-websocket');
    this.socket.onmessage = (message) => {
      try {
        const parsedMsg = JSON.parse(message.data)
        this.messages.push(parsedMsg);
        this.emit('message', this.messages)
      }
      catch(e) {
        console.warn(e);
      }

    }
    this.socket.onopen = () => {
      this.connected = true;
      this.emit('message', this.messages);
    }
    this.socket.onerror = (err) => {
      console.warn('error connecting chat', err);
      this.connected = false;
      this.disconnect();
    }
  }

  send(message: ChatMessage ) {
    if (!this.socket)
      return;
    this.socket.send(JSON.stringify(message));
  }

  disconnect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      this.connected = false;
    }
  }
}

type ChatMessage = {
  name: string;
  message: string;
}

export const GlobalChat: React.FC = () => {
  const [, setForceUpdate] = useState(false);
  const forceUpdate = () => {
    setForceUpdate(old => !old);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  useEffect(() => {
    let cs = new ChatState();
    setChatState(cs);
    cs.connect();
    setMessages([{name: "client", message:"connecting to the chat..."}]);
    cs.on("message", (messages) => {
      setMessages(messages);
      forceUpdate();
    });
    return () => {
      if (chatState) {
        chatState.disconnect();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [message, setMessage] = useState('');
  let chatIsReady = chatState && chatState.connected;
  const send = () => {
    if (!(chatState && chatState.connected)) {
      return;
    }
    let formattedMessage = {message: message, name: "test"};
    chatState.send(formattedMessage);
    setMessages((m: ChatMessage[]) => [...m, formattedMessage]);
    setMessage("");
  }
  return <div className='global-chat'>
    <div className='chat-container'>
      <Scrollbars
        renderThumbHorizontal={(props) => <div {...props} className='thumb' />}
        renderThumbVertical={(props) => <div {...props} className='thumb' />}
        style={{ width: '100%', height: '100%' }}>
        <div className='chat'>
          {messages.map((m, i) => {
            return <div className='line' key={i}>
              {m.name}:{m.message}
            </div>;
          })}
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
