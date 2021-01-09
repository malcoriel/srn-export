import React, { useEffect, useState } from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './HtmlLayers/DebugStateLayer';
import { scaleConfig, size } from './world';
import { CoordLayer } from './KonvaLayers/CoordLayer';
import NetState, { Timeout } from './NetState';
import { ShipControls } from './utils/ShipControls';
import { GameHTMLHudLayer } from './HtmlLayers/GameHTMLHudLayer';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Perf, statsHeap, StatsPanel } from './HtmlLayers/Perf';
import { vsyncedDecoupledTime } from './utils/Times';
import { MainMenuLayer } from './HtmlLayers/MainMenuLayer';
import { LeaderboardLayer } from './HtmlLayers/LeaderboardLayer';
import { ThreeLayer } from './ThreeLayers/ThreeLayer';
import { NamesLayer } from './KonvaLayers/NamesLayer';
import * as uuid from 'uuid';
import { MyTrajectoryLayer } from './KonvaLayers/MyTrajectoryLayer';
import { HelpLayer } from './HtmlLayers/HelpLayer';
import './HtmlLayers/Panel.scss';
import { MinimapLayerWrapper } from './KonvaLayers/MinimapLayerWrapper';
import { InGameLeaderBoardPanel } from './HtmlLayers/InGameLeaderboardPanel';
import { QuestPanel } from './HtmlLayers/QuestPanel';
import 'react-jinke-music-player/assets/index.css';
import { DialoguePanel } from './HtmlLayers/DialoguePanel';
import { MusicControls } from './MusicControls';
import { randBetweenExclusiveEnd } from './utils/rand';
import { HotkeyWrapper } from './HotkeyWrapper';

const MONITOR_SIZE_INTERVAL = 1000;

function genRandomName() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: '-',
  }).toUpperCase();
}

const portraits = [
  '1.jpg',
  '2.jpg',
  '3.jpg',
  '4.jpg',
  '5.jpg',
  '6.jpg',
  '7.jpg',
  '8.jpg',
  '9.jpg',
];

function portraitPath(portraitIndex: number) {
  return `resources/chars/${portraits[portraitIndex]}`;
}

let monitorSizeInterval: Timeout | undefined;
const Srn = () => {
  const [playing, setPlaying] = useState(false);
  const [menu, setMenu] = useState(true);
  const [preferredName, setPreferredName] = useState(genRandomName());
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [portraitIndex, setPortraitIndex] = useState(0);
  const [portrait, setPortrait] = useState('0');
  const [trigger, setTrigger] = useState(0);

  const nextPortrait = () => {
    let locIndex = (portraitIndex + 1) % portraits.length;
    let locPort = portraitPath(locIndex);
    setPortrait(locPort);
    setPortraitIndex(locIndex);
  };

  const previousPortrait = () => {
    let number = portraitIndex - 1;
    if (number < 0) number = portraits.length + number;
    let locIndex = number % portraits.length;
    let locPort = portraitPath(locIndex);

    setPortrait(locPort);
    setPortraitIndex(locIndex);
  };

  const forceUpdate = () => {
    setTrigger((trigger) => trigger + 1);
  };

  const updateSize = () => {
    if (
      size.width_px !== window.innerWidth ||
      size.height_px !== window.innerHeight
    ) {
      size.width_px = window.innerWidth;
      size.height_px = window.innerHeight;
      console.log('update size');
      forceUpdate();
    }
  };

  useEffect(() => {
    NetState.make();
    const ns = NetState.get();
    if (!ns) return;
    let locIndex = randBetweenExclusiveEnd(0, portraits.length);
    let locPort = portraitPath(locIndex);
    setPortrait(locPort);
    setPortraitIndex(locIndex);

    monitorSizeInterval = setInterval(updateSize, MONITOR_SIZE_INTERVAL);
    return () => {
      const ns = NetState.get();
      if (!ns) return;

      if (monitorSizeInterval) {
        clearInterval(monitorSizeInterval);
      }
      Perf.stop();
      ns.disconnect();
    };
  }, []);

  const start = () => {
    if (!NetState.get()) {
      NetState.make();
    }

    const ns = NetState.get();

    if (!ns) {
      return;
    }

    ns.playerName = preferredName;
    ns.portraitIndex = portraitIndex + 1; // portrait files are 1-based
    ns.disconnecting = false;
    ns.on('change', () => {
      forceUpdate();
    });
    ns.on('network', () => {
      forceUpdate();
    });
    ns.connect();
  };

  const quit = () => {
    const ns = NetState.get();
    if (!ns) return;
    ns.disconnect();
    setPlaying(false);
  };

  return (
    <>
      <div
        className="main-container"
        style={{
          position: 'relative',
          width: size.width_px,
          height: size.height_px,
        }}
      >
        {playing && (
          <>
            <MinimapLayerWrapper />
            <ThreeLayer />
            <Stage
              width={size.width_px}
              height={size.height_px}
              {...scaleConfig()}
              style={{ pointerEvents: 'none' }}
            >
              <NamesLayer />
              <MyTrajectoryLayer />
              <CoordLayer />
            </Stage>
            <ShipControls />
            <GameHTMLHudLayer />
            <InGameLeaderBoardPanel />
            <HelpLayer />
            <LeaderboardLayer />
            <QuestPanel />
          </>
        )}
        {musicEnabled && <MusicControls />}
        <DialoguePanel />
        {playing && (
          <HotkeyWrapper
            hotkey="esc"
            onPress={() => {
              setMenu(!menu);
            }}
          />
        )}
        {menu && (
          <MainMenuLayer
            nextPortrait={nextPortrait}
            previousPortrait={previousPortrait}
            portrait={portrait}
            makeRandomName={() => {
              setPreferredName(genRandomName());
            }}
            musicEnabled={musicEnabled}
            onPreferredNameChange={(name) => {
              setPreferredName(name);
            }}
            hide={() => setMenu(false)}
            playing={playing}
            onSetMusic={(value: boolean) => {
              setMusicEnabled(value);
            }}
            onGo={() => {
              setPlaying(true);
              setMenu(false);
              start();
            }}
            preferredName={preferredName}
            makeRandomPortrait={() => {
              let locIndex = randBetweenExclusiveEnd(0, portraits.length);
              setPortraitIndex(locIndex);
              setPortrait(portraitPath(locIndex));
            }}
            quit={quit}
          />
        )}
      </div>
      <DebugStateLayer />
      <StatsPanel />
    </>
  );
};

export default Srn;
