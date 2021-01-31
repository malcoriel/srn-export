import React, { useEffect, useState } from 'react';
import './GlobalChat.scss';
import { Input } from './ui/Input';
import { ChatMessage, Chats, ChatState } from '../ChatState';
import { useStore } from '../store';
import { WithScrollbars } from './ui/WithScrollbars';

export const GlobalChat: React.FC = () => {
  const preferredName = useStore(state => state.preferredName);

  const [, setForceUpdate] = useState(false);
  const forceUpdate = () => {
    setForceUpdate(old => !old);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    let onMessage = (messages: Chats) => {
      setMessages(messages.global);
      forceUpdate();
    };

    // force-delay chat connection as on game load
    // this component did mount happens earlier that Srn did mount
    setTimeout(() => {
      const cs = ChatState.get();
      if (!cs)
        return;
      cs.tryConnect(preferredName);
      setMessages(cs.messages.global);
      cs.on('message', onMessage);
    });
    return () => {
      const cs = ChatState.get();
      if (!cs)
        return;
      cs.off('message', onMessage);
      cs.tryDisconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [message, setMessage] = useState('');


  const cs = ChatState.get();
  if (!cs)
    return null;

  let chatIsReady = cs.connected;
  const send = () => {
    const cs = ChatState.get();
    if (!cs)
      return;
    let formattedMessage = { message: message, name: preferredName };
    cs.send(formattedMessage, "global");
    // optimistically update the component before message reaches
    // the server
    setMessages((m: ChatMessage[]) => [...m, formattedMessage]);
    setMessage('');
  };
  return <div className='global-chat'>
    <div className='header'>
      Global chat
    </div>
    <div className='chat-container'>
      <WithScrollbars
      >
        <div className='chat'>
          {messages.map((m, i) => {
            return <div className='line' key={i}>
              {m.name}:&nbsp;{m.message}
            </div>;
          })}
        </div>
      </WithScrollbars>
    </div>
    <div className='chat-input-container' onKeyDown={(ev: any) => {
      if (ev.code === 'Enter') {
        send();
      }
    }}>
      <Input disabled={!chatIsReady} className='chat-input'
             placeholder={chatIsReady ? 'say something in chat...' : undefined} value={message}
             onChange={(val) => setMessage(val.target.value)} />
    </div>
  </div>;
};
