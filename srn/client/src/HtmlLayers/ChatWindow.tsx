import React, { useEffect } from 'react';
import { Window } from './ui/Window';
import './ChatWindow.scss';
import { useStore } from '../store';
import { Chat } from './Chat';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';


export const ChatWindow = () => {
  useStore((state) => state.chatWindow);
  const forceUpdate = useStore(state => state.forceUpdate);
  useEffect(() => {
    setTimeout(forceUpdate, 1)
  }, []);

  return (
    <Window
      height={400}
      width={300}
      line='thick'
      thickness={10}
      storeKey='chatWindow'
      minimizedClassname={"chat-window-minimized"}
      minimized={
        <Chat channelName='inGame' />
      }
    >
      <div className="chat-window">
        <Tabs className="tabs">
          <TabList className="tabs-header">
            <Tab className="tab">In-Game chat</Tab>
            <Tab className="tab">Global chat</Tab>
          </TabList>
          <TabPanel className="tabs-panel">
            <Chat channelName='inGame' />
          </TabPanel>
          <TabPanel className="tabs-panel">
            <Chat channelName='global' />
          </TabPanel>

        </Tabs>

      </div>
    </Window>
  );
};
