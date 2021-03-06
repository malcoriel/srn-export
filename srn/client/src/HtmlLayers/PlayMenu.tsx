import React from 'react';
import { Button } from './ui/Button';

export const PlayMenu: React.FC<{
  startTutorial: () => void;
  start: () => void;
  startSandbox: () => void;
  hide: () => void;
}> = ({ startTutorial, start, hide, startSandbox }) =>
  <div className='play-menu'>
    <div>
      I recommend doing the tutorial if it's your first time here:
    </div>
    <Button className='play' onClick={startTutorial} hotkey='t' text='TUTORIAL' />
    <div>
      Right now, you can play the cargo rush mode, where you
      can compete with bots (and other players, if any) to get
      the most amount of money in 3 minutes:
    </div>
    <Button className='play' onClick={start} hotkey='c' text='CARGO RUSH' />
    <div>
      There is a playground for building systems:
    </div>
    <Button className='play' onClick={startSandbox} hotkey='S' text='SANDBOX' />
    <div>
      Or you can just go to the main menu:
    </div>
    <Button className='play' onClick={hide} hotkey='b' text='BACK' />
  </div>;
