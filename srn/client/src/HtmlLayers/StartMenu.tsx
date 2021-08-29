import React, { useEffect, useState } from 'react';
import './StartMenu.scss';
import {
  FaAngleLeft,
  FaAngleRight,
  FaDiceD20,
  FaTelegram,
} from 'react-icons/fa';
import Slider from 'rc-slider';
import useSWR from 'swr';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Input } from './ui/Input';
import { TestMenuMode, useStore } from '../store';
import 'rc-slider/assets/index.css';
import { teal } from '../utils/palette';
import versionJson from '../../version.json';
import { api } from '../utils/api';
import { GlobalChat } from './GlobalChat';
import { Changelog } from './Changelog';
import { PlayMenu } from './PlayMenu';
import { GameMode } from '../../../world/pkg/world.extra';

// to only skip menu once
let firstTime = true;
export const makePortraitPath = (portrait: string) =>
  `resources/chars/${portrait}.png`;

export const StartMenu: React.FC<{
  start: (mode: GameMode) => void;
  quit: () => void;
  seed: string;
  locationSeed: string;
}> = ({ start, quit, seed, locationSeed }) => {
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
    volume,
    setVolume,
    testMenuMode,
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
    volume: state.volume,
    setVolume: state.setVolume,
    testMenuMode: state.testMenuMode,
  }));

  const hide = () => setMenu(false);

  useEffect(() => {
    if (skipMenu && firstTime) {
      start(GameMode.CargoRush);
      firstTime = false;
    }
  }, [skipMenu, start]);

  const [playMenu, setPlayMenu] = useState(false);

  const serverVersion = useSWR('/api/version', async () => api.getVersion());

  let serverVersionFormatted;
  let serverIsDownOrDiffVersion = false;
  if (serverVersion.error) {
    serverVersionFormatted = 'server is down';
    serverIsDownOrDiffVersion = true;
  } else if (!serverVersion.data) {
    serverVersionFormatted = 'loading...';
    serverIsDownOrDiffVersion = true;
  } else {
    serverVersionFormatted = serverVersion.data;
    serverIsDownOrDiffVersion = versionJson.version !== serverVersionFormatted;
  }

  if (testMenuMode !== TestMenuMode.Hidden) {
    return null;
  }

  return (
    <div className="start-menu">
      {!playing && (
        <div className="global-chat-container">
          <GlobalChat />
        </div>
      )}
      {!playMenu && (
        <div className="start-hud">
          <div className="title">Star Rangers Network</div>
          {!playing && (
            <>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              <Label>So, what's your name, ranger?</Label>
              <div className="name-selector">
                <Input
                  className="name-input"
                  value={preferredName}
                  onChange={(e) => {
                    const name = e.target.value;
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
              <Label>And how do you look?</Label>
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
          <div className="music-toggle">
            <Label>Music</Label>

            <Button
              onClick={() => {
                setMusicEnabled(true);
              }}
              toggled={musicEnabled}
              text="ON"
              hotkey="O"
            />
            <Button
              onClick={() => {
                setMusicEnabled(false);
              }}
              toggled={!musicEnabled}
              hotkey="F"
              text="OFF"
            />
          </div>
          {playing && (
            <>
              <div className="music-volume">
                <Label className="music-volume-label">Music volume</Label>
                <span className="music-volume-bar-cont">
                  <Slider
                    min={0}
                    max={100}
                    className="music-volume-bar"
                    handleStyle={{
                      backgroundColor: teal,
                    }}
                    trackStyle={{
                      backgroundColor: teal,
                    }}
                    railStyle={{
                      backgroundColor: teal,
                    }}
                    value={volume}
                    onChange={setVolume}
                  />
                </span>
              </div>
              <div className="autostart-toggle">
                <Label>Skip menu</Label>

                <Button onClick={() => setSkipMenu(true)} toggled={skipMenu}>
                  ON
                </Button>
                <Button onClick={() => setSkipMenu(false)} toggled={!skipMenu}>
                  OFF
                </Button>
              </div>
            </>
          )}
          {!playing && (
            <Button
              className="play"
              onClick={() => setPlayMenu(true)}
              text="PLAY"
              hotkey="P"
              disabled={serverIsDownOrDiffVersion}
            />
          )}
          {playing && (
            <>
              <Button className="play" onClick={hide} text="BACK" hotkey="b" />
              <Button className="quit" onClick={quit} hotkey="Q" text="QUIT" />
            </>
          )}
          {playing && (
            <div className="game-seeds">
              <div>Game seeds:</div>
              <div>
                <span className="normal-selection">{seed}</span> (global)
              </div>
              <div>
                <span className="normal-selection">{locationSeed}</span>{' '}
                (location)
              </div>
            </div>
          )}
        </div>
      )}
      {playMenu && <PlayMenu start={start} hide={() => setPlayMenu(false)} />}
      <div className="versions-status">
        <div>
          Client version:&nbsp;
          {versionJson.version}
        </div>
        <div>
          Server version:&nbsp;
          {serverVersionFormatted}
        </div>
      </div>
      <div className="about">
        {/* eslint-disable-next-line react/jsx-no-target-blank */}
        <a href="https://t.me/joinchat/WLDnjKtHTPplQZje" target="_blank">
          <FaTelegram />
          &nbsp; news & talk
        </a>
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        <div className="authorship">Game by Valeriy 'Malcoriel' Kuzmin</div>
        <div className="authorship">Character images by artbreeder.com</div>
        <div className="authorship">Music powered by aiva.ai</div>
      </div>
      {!playing && (
        <div className="changelog-container">
          <Changelog />
        </div>
      )}
    </div>
  );
};
