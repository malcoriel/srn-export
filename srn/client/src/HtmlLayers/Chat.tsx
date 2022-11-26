import React, { useEffect, useState } from 'react';
import './Chat.scss';
import { Input } from './ui/Input';
import { ChatMessage, Chats, ChatState } from '../ChatState';
import { useStore } from '../store';
import { WithScrollbars } from './ui/WithScrollbars';
import { useNSForceChange } from '../NetStateHooks';
import NetState from '../NetState';

export const Chat: React.FC<{ channelName: string; header?: string }> = ({
  channelName,
  header,
}) => {
  const preferredName = useStore((state) => state.preferredName);

  const eventsFromState = [];
  if (channelName === 'events') {
    const ns = NetState.get();
    if (ns) {
      const state = ns.state;
      const events = state.processed_events.filter(
        (e: any) => !!e.text_representation
      );
      eventsFromState.push(
        ...events.map((e: any) => ({
          name: 'event',
          message: e.text_representation,
        }))
      );
    }
  }

  const [, setForceUpdate] = useState(false);
  const forceUpdate = () => {
    setForceUpdate((old) => !old);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    const onMessage = (messages: Chats) => {
      setMessages(messages[channelName]);
      forceUpdate();
    };

    // force-delay chat connection as on game load
    // this component did mount happens earlier that Srn did mount
    setTimeout(() => {
      const cs = ChatState.get();
      if (!cs) return;
      setMessages(cs.messages[channelName]);
      cs.on('message', onMessage);
    }, 100);
    return () => {
      const cs = ChatState.get();
      if (!cs) return;
      cs.off('message', onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [message, setMessage] = useState('');

  const cs = ChatState.get();
  if (!cs) return null;

  const chatIsReady = cs.connected;
  const send = () => {
    const cs = ChatState.get();
    if (!cs) return;
    const formattedMessage = { message, name: preferredName };
    cs.send(formattedMessage, channelName);
    // optimistically update the component before message reaches
    // the server
    setMessages((m: ChatMessage[]) => [...m, formattedMessage]);
    setMessage('');
  };
  return (
    <div className="chat">
      {header && <div className="header">{header}</div>}
      <div className="chat-container">
        <WithScrollbars>
          <div className="chat-contents">
            {messages.map((m, i) => (
              <div className="line" key={i}>
                {m.name}
                :&nbsp;
                {m.message}
              </div>
            ))}
          </div>
        </WithScrollbars>
      </div>
      <div
        className="chat-input-container"
        onKeyDown={(ev: any) => {
          if (ev.code === 'Enter') {
            send();
          }
        }}
      >
        <Input
          noPropagation
          disabled={!chatIsReady}
          className="chat-input"
          placeholder={chatIsReady ? 'say something in chat...' : undefined}
          value={message}
          onChange={(val) => setMessage(val.target.value)}
        />
      </div>
    </div>
  );
};
