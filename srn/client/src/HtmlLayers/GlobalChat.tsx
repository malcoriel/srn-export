import React, { useEffect, useState } from 'react';
import './GlobalChat.scss';
import { Input } from './ui/Input';
import { Scrollbars } from 'rc-scrollbars';
import { ChatState } from '../ChatState';
import { useStore } from '../store';

export type ChatMessage = {
  name: string;
  message: string;
}

export const GlobalChat: React.FC = () => {
  const [, setForceUpdate] = useState(false);
  const forceUpdate = () => {
    setForceUpdate(old => !old);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    let onMessage = (messages: ChatMessage[]) => {
      setMessages(messages);
      forceUpdate();
    };

    // force-delay chat connection as on game load
    // this component did mount happens earlier that Srn did mount
    setTimeout(() => {
      const cs = ChatState.get();
      if (!cs)
        return;
      cs.tryConnect()
      setMessages(cs.messages);
      cs.on("message", onMessage);
    });
    return () => {
      const cs = ChatState.get();
      if (!cs)
        return;
      cs.off("message", onMessage);
      cs.tryDisconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [message, setMessage] = useState('');

  const preferredName = useStore(state => state.preferredName);

  const cs = ChatState.get();
  if (!cs)
    return null;

  let chatIsReady = cs.connected;
  const send = () => {
    const cs = ChatState.get();
    if (!cs)
      return;
    let formattedMessage = {message: message, name: preferredName};
    cs.send(formattedMessage);
    // optimistically update the component before message reaches
    // the server
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
