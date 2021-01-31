import React from 'react';
import './Chat.scss';
import { Chat } from './Chat';

export const GlobalChat: React.FC = () => {
  return <Chat channelName={"global"} header={"Global chat"}/>;
};
