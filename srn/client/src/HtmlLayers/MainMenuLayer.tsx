import React, { useEffect, useState } from 'react';
import './MainMenu.scss';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { FaAngleRight, FaDiceD20 } from 'react-icons/fa';
import { FaAngleLeft } from 'react-icons/fa';
import { useLocalStorage } from '../utils/useLocalStorage';

// to only skip menu once
let firstTime = true;

export const MainMenuLayer: React.FC<{
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
  quit: () => void;
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
  quit,
}) => {
  const [lsName, setLsName] = useLocalStorage('preferredName', preferredName);
  const [lsMusicEnabled, setLsMusicEnabled] = useLocalStorage(
    'musicEnabled',
    musicEnabled
  );
  const [lsSkipMenu, setLsSkipMenu] = useLocalStorage('skipMenu', false);

  useEffect(() => {
    if (lsName !== preferredName && lsName) {
      // got something saved
      onPreferredNameChange(lsName);
    }
    if (typeof lsMusicEnabled === 'boolean' && lsMusicEnabled != musicEnabled) {
      onSetMusic(lsMusicEnabled);
    }
    if (lsSkipMenu && firstTime) {
      onGo();
      firstTime = false;
    }
  }, []);
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
              onChange={(e) => {
                let name = e.target.value;
                setLsName(name);
                onPreferredNameChange(name);
              }}
            />
            <Button
              className="dice"
              onClick={() => {
                setLsName(null);
                makeRandomName();
              }}
            >
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
        <Button
          onClick={() => {
            setLsMusicEnabled(true);
            onSetMusic(true);
          }}
          toggled={musicEnabled}
        >
          ON
        </Button>
        <Button
          onClick={() => {
            setLsMusicEnabled(false);
            onSetMusic(false);
          }}
          toggled={!musicEnabled}
        >
          OFF
        </Button>
      </div>
      <Label>Skip this screen on startup next time</Label>
      <div className="autostart-toggle">
        <Button onClick={() => setLsSkipMenu(true)} toggled={lsSkipMenu}>
          ON
        </Button>
        <Button onClick={() => setLsSkipMenu(false)} toggled={!lsSkipMenu}>
          OFF
        </Button>
      </div>
      {!playing && (
        <Button className="play" onClick={onGo}>
          PLAY
        </Button>
      )}
      {playing && (
        <>
          <Button className="play" onClick={hide}>
            BACK
          </Button>
          <Button className="quit" onClick={quit}>
            QUIT
          </Button>
        </>
      )}
      {/*<Button text="About" onClick={() => setAbout(true)} />*/}
    </div>
  );
};
