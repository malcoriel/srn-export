import React from 'react';
import { Button } from './ui/Button';

export const WatchMenu: React.FC<{
  hide: () => void;
}> = ({ hide }) => (
  <div className="play-menu">
    <div>Watch a recorded game saved on server</div>
    <Button className="play" onClick={hide} hotkey="r" text="REPLAY" />
    <div>Or you can just go to the main menu:</div>
    <Button className="play" onClick={hide} hotkey="b" text="BACK" />
  </div>
);
