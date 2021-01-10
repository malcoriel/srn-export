import React, { useEffect } from 'react';
import './StartMenu.scss';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { FaAngleRight, FaDiceD20 } from 'react-icons/fa';
import { FaAngleLeft } from 'react-icons/fa';
import { useLocalStorage } from '../utils/useLocalStorage';
import { useStore } from '../store';

// to only skip menu once
let firstTime = true;
export const makePortraitPath = (portrait: string) =>
  `resources/chars/${portrait}.png`;

export const StartMenu: React.FC<{
  start: () => void;
  quit: () => void;
}> = ({ start, quit }) => {
  const {
    musicEnabled,
    setMusicEnabled,
    nextPortrait,
    prevPortrait,
    preferredName,
    setPreferredName,
    makeRandomName,
    portrait,
    playing,
    setMenu,
    skipMenu,
    setSkipMenu,
    makeRandomPortrait,
  } = useStore((state) => ({
    musicEnabled: state.musicEnabled,
    setMusicEnabled: state.setMusicEnabled,
    nextPortrait: state.nextPortrait,
    prevPortrait: state.prevPortrait,
    preferredName: state.preferredName,
    setPreferredName: state.setPreferredName,
    makeRandomName: state.makeRandomName,
    setMenu: state.setMenu,
    playing: state.playing,
    portrait: state.portrait,
    skipMenu: state.skipMenu,
    setSkipMenu: state.setSkipMenu,
    makeRandomPortrait: state.makeRandomPortrait,
  }));

  const hide = () => setMenu(false);

  useEffect(() => {
    if (skipMenu && firstTime) {
      start();
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
                setPreferredName(name);
              }}
            />
            <Button
              className="dice"
              onClick={() => {
                makeRandomName();
              }}
            >
              <FaDiceD20 />
            </Button>
          </div>
          <Label>And how would you look?</Label>
          <div className="portrait-selector">
            <Button className="prev" onClick={prevPortrait}>
              <FaAngleLeft />
            </Button>
            <div className="image-cont">
              <img
                className="image"
                src={makePortraitPath(portrait)}
                alt="chosen-portrait"
              />
              <Button className="dice" onClick={makeRandomPortrait}>
                <FaDiceD20 />
              </Button>
            </div>
            <Button
              className="next"
              onClick={() => {
                nextPortrait();
              }}
            >
              <FaAngleRight />
            </Button>
          </div>
        </>
      )}
      <Label>Music (written by AIVA)</Label>
      <div className="music-toggle">
        <Button
          onClick={() => {
            setMusicEnabled(true);
          }}
          toggled={musicEnabled}
        >
          ON
        </Button>
        <Button
          onClick={() => {
            setMusicEnabled(false);
          }}
          toggled={!musicEnabled}
        >
          OFF
        </Button>
      </div>
      <Label>Skip this screen on startup next time</Label>
      <div className="autostart-toggle">
        <Button onClick={() => setSkipMenu(true)} toggled={skipMenu}>
          ON
        </Button>
        <Button onClick={() => setSkipMenu(false)} toggled={!skipMenu}>
          OFF
        </Button>
      </div>
      {!playing && (
        <Button className="play" onClick={start}>
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
