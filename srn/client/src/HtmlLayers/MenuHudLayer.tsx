import React, { useState } from 'react';
import './StartHud.scss';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { FaAngleRight, FaDiceD20 } from 'react-icons/fa';
import { FaAngleLeft } from 'react-icons/fa';
export const MenuHudLayer: React.FC<{
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
  playing: boolean;
  hide: () => void;
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
  playing,
  hide,
}) => {
  const [about, setAbout] = useState(false);
  return (
    <div className="start-hud">
      <div className="title">Star Rangers Network</div>
      {!playing && (
        <>
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
        </>
      )}
      <Label>Music (written by AIVA)</Label>
      <div className="music-toggle">
        <Button onClick={() => onSetMusic(true)} toggled={musicEnabled}>
          ON
        </Button>
        <Button onClick={() => onSetMusic(false)} toggled={!musicEnabled}>
          OFF
        </Button>
      </div>
      {!playing && (
        <Button className="play" onClick={onGo}>
          PLAY
        </Button>
      )}
      {playing && (
        <Button className="play" onClick={hide}>
          BACK
        </Button>
      )}
      {/*<Button text="About" onClick={() => setAbout(true)} />*/}
    </div>
  );
};
