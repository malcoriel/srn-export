import React from 'react';
import { hotkeyRegistry } from '../utils/useToggleHotkey';
import { Window } from './ui/Window';
import './ChatWindow.scss';
import { useStore } from '../store';
import { Chat } from './Chat';

export const ChatWindow = () => {
  useStore((state) => state.chatWindow);

  return (
    <Window
      height={400}
      width={300}
      line='thick'
      thickness={10}
      storeKey='chatWindow'
    >
      <div className="chat-window"><Chat channelName='inGame' header='In-game chat' /></div>
    </Window>
  );
};
