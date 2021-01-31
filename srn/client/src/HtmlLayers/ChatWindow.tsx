import React from 'react';
import { Window } from './ui/Window';
import './ChatWindow.scss';
import { useStore } from '../store';
import { Chat } from './Chat';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';


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
      <div className="chat-window">
        <Tabs className="tabs">
          <TabList className="tabs-header">
            <Tab className="tab">Global</Tab>
            <Tab className="tab">In-Game</Tab>
          </TabList>
          <TabPanel className="tabs-panel">
            <Chat channelName='global' />
          </TabPanel>
          <TabPanel className="tabs-panel">
            <Chat channelName='inGame' />
          </TabPanel>
        </Tabs>

      </div>
    </Window>
  );
};
