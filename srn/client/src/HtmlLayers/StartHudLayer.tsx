import React, { useState } from 'react';
import './StartHud.scss';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { FaAngleRight, FaDiceD20 } from 'react-icons/fa';
import { FaAngleLeft } from 'react-icons/fa';
export const StartHudLayer: React.FC<{
  preferredName: string;
  onPreferredNameChange: (n: string) => void;
  onGo: () => void;
  previousPortrait: () => void;
  nextPortrait: () => void;
  makeRandomName: () => void;
  makeRandomPortrait: () => void;
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
  makeRandomPortrait,
  previousPortrait,
  nextPortrait,
  portrait,
}) => {
  const [about, setAbout] = useState(false);
  return (
    <div className="start-hud">
      <div className="title">Star Rangers Network</div>
      <Label>So, what's your name, ranger?</Label>
      <div className="name-selector">
        <Input
          className="name-input"
          value={preferredName}
          onChange={(e) => onPreferredNameChange(e.target.value)}
        />
        <Button className="dice" onClick={makeRandomName}>
          <FaDiceD20 />
        </Button>
      </div>
      <Label>And how would you look?</Label>
      <div className="portrait-selector">
        <Button className="prev" onClick={previousPortrait}>
          <FaAngleLeft />
        </Button>
        <div className="image-cont">
          <img className="image" src={portrait} alt="chosen-portrait" />
          <Button className="dice" onClick={makeRandomPortrait}>
            <FaDiceD20 />
          </Button>
        </div>
        <Button className="next" onClick={nextPortrait}>
          <FaAngleRight />
        </Button>
      </div>
      <Label>Music (written by AIVA)</Label>
      <div className="music-toggle">
        <Button onClick={() => onSetMusic(true)} toggled={musicEnabled}>
          ON
        </Button>
        <Button onClick={() => onSetMusic(false)} toggled={!musicEnabled}>
          OFF
        </Button>
      </div>
      <Button className="play" onClick={onGo}>
        PLAY
      </Button>
      {/*<Button text="About" onClick={() => setAbout(true)} />*/}
    </div>
  );
};
