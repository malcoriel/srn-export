import React, { useState } from 'react';
import './StartHud.scss';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';

export const StartHudLayer: React.FC<{
  preferredName: string;
  onPreferredNameChange: (n: string) => void;
  onGo: () => void;
  previousPortrait: () => void;
  nextPortrait: () => void;
  makeRandomName: () => void;
  onSetMusic: (val: boolean) => void;
  musicEnabled: boolean;
  portrait: string;
}> = ({
  preferredName,
  onPreferredNameChange,
  onGo,
  onSetMusic,
  musicEnabled,
  makeRandomName,
  previousPortrait,
  nextPortrait,
  portrait,
}) => {
  const [about, setAbout] = useState(false);
  return (
    <div className="start-hud">
      <div className="title">Star Rangers Network</div>
      <Label>So, what's your name, ranger?</Label>
      <Input
        className="name-input"
        value={preferredName}
        onChange={(e) => onPreferredNameChange(e.target.value)}
      />
      <Button text="Random" onClick={makeRandomName} />
      <Label>And how would you look?</Label>
      <div className="portrait-selector">
        <Button text="Previous" onClick={previousPortrait} />
        <img className="image" src={portrait} alt="chosen-portrait" />
        <Button text="Next" onClick={nextPortrait} />
      </div>
      <Label>Music (written by AIVA)</Label>
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
      {/*<Button text="About" onClick={() => setAbout(true)} />*/}
    </div>
  );
};
