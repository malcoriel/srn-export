import React, { useEffect, useState } from 'react';
import './GlobalChat.scss';
import { Input } from './ui/Input';
import { Scrollbars } from 'rc-scrollbars';

export const GlobalChat: React.FC = () => {
  const [messages, setMessages] = useState(['789', '789', '789', '789']);
  useEffect(() => {
    setMessages(m => [...m, 'qq']);
  }, []);
  const [message, setMessage] = useState('');
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
        setMessages(m => [...m, message]);
        setMessage("");
      }
    }}>
      <Input className='chat-input' placeholder='say something in chat...' value={message}
             onChange={(val) => setMessage(val.target.value)} />
    </div>
  </div>;
};
