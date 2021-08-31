import React from 'react';
import { Button } from './ui/Button';
import { GameMode } from '../../../world/pkg/world.extra';

export const PlayMenu: React.FC<{
  start: (gameMode: GameMode) => void;
  hide: () => void;
}> = ({ start, hide }) => (
  <div className="play-menu">
    {/* eslint-disable-next-line react/no-unescaped-entities */}
    <div>If it's your first time here, try tutorial to learn the basics:</div>
    <Button
      className="play"
      onClick={() => start(GameMode.Tutorial)}
      hotkey="t"
      text="TUTORIAL"
    />
    <div>
      Play with bots or other players to earn the most money in 3 minutes:
    </div>
    <Button
      className="play"
      onClick={() => start(GameMode.CargoRush)}
      hotkey="c"
      text="CARGO RUSH"
    />
    <div>Defend a planet against hordes of invader ships:</div>
    <Button
      className="play"
      onClick={() => start(GameMode.PirateDefence)}
      hotkey="d"
      text="PIRATE DEFENCE"
    />
    <div>Playground for building systems, press G to see the builder menu:</div>
    <Button
      className="play"
      onClick={() => start(GameMode.Sandbox)}
      hotkey="S"
      text="SANDBOX"
    />
    <div>Or you can just go to the main menu:</div>
    <Button className="play" onClick={hide} hotkey="b" text="BACK" />
  </div>
);
