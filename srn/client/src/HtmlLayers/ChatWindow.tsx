import React, { useEffect, useState } from 'react';
import { Window } from './ui/Window';
import './ChatWindow.scss';
import { useStore } from '../store';
import { Chat } from './Chat';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { GameEventsLog } from './GameEventsLog';
import classNames from 'classnames';

export const ChatWindow = () => {
  useStore((state) => state.chatWindow);
  const forceUpdate = useStore((state) => state.forceUpdate);
  useEffect(() => {
    setTimeout(forceUpdate, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <Window
      height={600}
      width={800}
      line="thick"
      thickness={10}
      storeKey="chatWindow"
      minimizedClassname="chat-window-minimized"
      minimized={<Chat channelName="inGame" />}
    >
      <div className="chat-window">
        <Tabs
          className="tabs"
          selectedIndex={selectedIndex}
          onSelect={(reactTabsSelectedIndex) => {
            setSelectedIndex(reactTabsSelectedIndex);
          }}
        >
          <TabList className="tabs-header react-tabs__tab-list">
            <Tab
              className={classNames({
                'react-tabs__tab': true,
                tab: true,
                'keep-selected-style': selectedIndex === 0,
              })}
              tabIndex="0"
            >
              In-Game chat
            </Tab>
            <Tab
              className={classNames({
                'react-tabs__tab': true,
                tab: true,
                'keep-selected-style': selectedIndex === 1,
              })}
              tabIndex="0"
            >
              Global chat
            </Tab>
            <Tab
              className={classNames({
                'react-tabs__tab': true,
                tab: true,
                'keep-selected-style': selectedIndex === 2,
              })}
              tabIndex="0"
            >
              Game events
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel tabs-panel">
            <Chat channelName="inGame" />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel tabs-panel">
            <Chat channelName="global" />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel tabs-panel">
            <GameEventsLog />
          </TabPanel>
        </Tabs>
      </div>
    </Window>
  );
};
