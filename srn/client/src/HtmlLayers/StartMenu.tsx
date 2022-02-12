import React, { useState } from 'react';
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
import { MainUiState, TestMenuMode, useStore } from '../store';
import 'rc-slider/assets/index.css';
import { teal } from '../utils/palette';
import versionJson from '../../version.json';
import { api } from '../utils/api';
import { GlobalChat } from './GlobalChat';
import { Changelog } from './Changelog';
import { PlayMenu } from './PlayMenu';
import { GameMode } from '../../../world/pkg/world.extra';
import { WatchMenu } from './WatchMenu';

export const makePortraitPath = (portrait: string) =>
  `resources/chars/${portrait}.png`;

enum StartMenuState {
  MainStartScreen = 0,
  Play = 1,
  Watch = 2,
}

export const StartMenu: React.FC<{
  start: (mode: GameMode) => void;
  startWatch: (replayId: string) => void;
  quit: () => void;
  seed: string;
  locationSeed: string;
}> = ({ start, quit, seed, locationSeed, startWatch }) => {
  const {
    musicEnabled,
    setMusicEnabled,
    nextPortrait,
    prevPortrait,
    preferredName,
    setPreferredName,
    makeRandomName,
    portrait,
    mainUiState,
    setMenu,
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
    mainUiState: state.mainUiState,
    portrait: state.portrait,
    makeRandomPortrait: state.makeRandomPortrait,
    volume: state.volume,
    setVolume: state.setVolume,
    testMenuMode: state.testMenuMode,
  }));

  const hide = () => setMenu(false);

  const [menuState, setMenuState] = useState<StartMenuState>(
    StartMenuState.MainStartScreen
  );

  const serverVersion = useSWR('/api/version', async () => api.getVersion());

  let serverVersionFormatted;
  let serverIsDownOrDiffVersion;
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
      {mainUiState === MainUiState.Idle ? (
        <div className="global-chat-container">
          <GlobalChat />
        </div>
      ) : null}
      {menuState === StartMenuState.MainStartScreen && (
        <div className="start-hud">
          <div className="title">Star Rangers Network</div>
          {mainUiState === MainUiState.Idle ? (
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
          ) : null}
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
          {mainUiState === MainUiState.Playing ? (
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
            </>
          ) : null}
          {mainUiState === MainUiState.Idle && (
            <>
              {menuState === StartMenuState.MainStartScreen && (
                <Button
                  className="play"
                  onClick={() => setMenuState(StartMenuState.Play)}
                  text="PLAY"
                  hotkey="P"
                  disabled={serverIsDownOrDiffVersion}
                />
              )}
              {menuState === StartMenuState.MainStartScreen && (
                <Button
                  className="play"
                  onClick={() => setMenuState(StartMenuState.Watch)}
                  text="WATCH"
                  hotkey="W"
                  disabled={serverIsDownOrDiffVersion}
                />
              )}
            </>
          )}

          {mainUiState === MainUiState.Playing && (
            <>
              <Button className="play" onClick={hide} text="BACK" hotkey="b" />
              <Button className="quit" onClick={quit} hotkey="Q" text="QUIT" />
            </>
          )}
          {mainUiState === MainUiState.Playing && (
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
      {mainUiState === MainUiState.Idle ? (
        <>
          {menuState === StartMenuState.Play && (
            <PlayMenu
              start={start}
              hide={() => setMenuState(StartMenuState.MainStartScreen)}
            />
          )}
          {menuState === StartMenuState.Watch && (
            <WatchMenu
              startWatch={startWatch}
              hide={() => setMenuState(StartMenuState.MainStartScreen)}
            />
          )}
        </>
      ) : null}

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
      {mainUiState === MainUiState.Idle && (
        <div className="changelog-container">
          <Changelog />
        </div>
      )}
    </div>
  );
};
