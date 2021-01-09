import React, { useState } from 'react';
import './StartHud.scss';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';

export const StartHudLayer: React.FC<{
  preferredName: string;
  onPreferredNameChange: (n: string) => void;
  onGo: () => void;
  makeRandomName: () => void;
  onSetMusic: (val: boolean) => void;
  musicEnabled: boolean;
}> = ({
  preferredName,
  onPreferredNameChange,
  onGo,
  onSetMusic,
  musicEnabled,
  makeRandomName,
}) => {
  const [about, setAbout] = useState(false);
  return (
    <div className="start-hud">
      <div className="title">Star Rangers Network</div>
      <Label text="Let's name you" />
      <Input
        className="name-input"
        value={preferredName}
        onChange={(e) => onPreferredNameChange(e.target.value)}
      />
      <Button text="Random" onClick={makeRandomName} />

      <Label text="Music (written by AIVA)" />
      <div className="music-toggle">
        <Button
          text="ON"
          onClick={() => onSetMusic(true)}
          toggled={musicEnabled}
        />
        <Button
          text="OFF"
          onClick={() => onSetMusic(false)}
          toggled={!musicEnabled}
        />
      </div>
      <Button text="Play cargo rush mode" onClick={onGo} />
      <Button text="About" onClick={() => setAbout(true)} />
    </div>
  );
};
