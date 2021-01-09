import React, { useEffect } from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './HtmlLayers/DebugStateLayer';
import { scaleConfig, size } from './world';
import { CoordLayer } from './KonvaLayers/CoordLayer';
import NetState, { Timeout } from './NetState';
import { ShipControls } from './utils/ShipControls';
import { GameHTMLHudLayer } from './HtmlLayers/GameHTMLHudLayer';
import create from 'zustand';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Perf, StatsPanel } from './HtmlLayers/Perf';
import { MainMenuLayer } from './HtmlLayers/MainMenuLayer';
import { LeaderboardLayer } from './HtmlLayers/LeaderboardLayer';
import { ThreeLayer } from './ThreeLayers/ThreeLayer';
import { NamesLayer } from './KonvaLayers/NamesLayer';
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

type SrnState = {
  playing: boolean;
  setPlaying: (value: boolean) => void;
  menu: boolean;
  setMenu: (value: boolean) => void;
  preferredName: string;
  setPreferredName: (value: string) => void;
  musicEnabled: boolean;
  setMusicEnabled: (value: boolean) => void;
  portraitIndex: number;
  setPortraitIndex: (value: number) => void;
  portrait: string;
  setPortrait: (value: string) => void;
  nextPortrait: () => void;
  prevPortrait: () => void;
  trigger: number;
  forceUpdate: () => void;
};

export const useStore = create<SrnState>((set) => ({
  playing: false,
  menu: true,
  preferredName: genRandomName(),
  musicEnabled: true,
  portraitIndex: 0,
  portrait: '0',
  trigger: 0,

  setPreferredName: (val: string) => set({ preferredName: val }),
  setMenu: (val: boolean) => set({ menu: val }),
  setMusicEnabled: (val: boolean) => set({ musicEnabled: val }),
  setPortraitIndex: (val: number) => set({ portraitIndex: val }),
  setPortrait: (val: string) => set({ portrait: val }),
  forceUpdate: () => set((state) => ({ trigger: state.trigger + 1 })),
  setPlaying: (val: boolean) => set({ playing: val }),

  nextPortrait: () =>
    set((state) => {
      let locIndex = (state.portraitIndex + 1) % portraits.length;
      let locPort = portraitPath(locIndex);
      state.setPortrait(locPort);
      state.setPortraitIndex(locIndex);
      return {};
    }),

  prevPortrait: () =>
    set((state) => {
      let number = state.portraitIndex - 1;
      if (number < 0) number = portraits.length + number;
      let locIndex = number % portraits.length;
      let locPort = portraitPath(locIndex);
      state.setPortrait(locPort);
      state.setPortraitIndex(locIndex);
      return {};
    }),
}));

let monitorSizeInterval: Timeout | undefined;
const Srn = () => {
  const {
    playing,
    setPlaying,
    menu,
    setMenu,
    preferredName,
    setPreferredName,
    musicEnabled,
    portraitIndex,
    setPortraitIndex,
    portrait,
    setPortrait,
    forceUpdate,
  } = useStore((state: SrnState) => ({ ...state }));

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
    if (!NetState.get()) {
      NetState.make();
    }
    const ns = NetState.get();
    if (!ns) return;
    let locIndex = randBetweenExclusiveEnd(0, portraits.length);
    let locPort = portraitPath(locIndex);
    setPortrait(locPort);
    setPortraitIndex(locIndex);

    monitorSizeInterval = setInterval(updateSize, MONITOR_SIZE_INTERVAL);

    if (playing) {
      start();
    }
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
    console.log('starting');
    if (!NetState.get()) {
      NetState.make();
    }

    const ns = NetState.get();

    if (!ns) {
      return;
    }
    setPlaying(true);
    setMenu(false);
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
            <DialoguePanel />
            <HotkeyWrapper
              hotkey="esc"
              onPress={() => {
                setMenu(!menu);
              }}
            />
            <DebugStateLayer />
            <StatsPanel />
          </>
        )}
        {musicEnabled && <MusicControls />}
        {menu && (
          <MainMenuLayer
            portrait={portrait}
            makeRandomName={() => {
              setPreferredName(genRandomName());
            }}
            onPreferredNameChange={(name) => {
              setPreferredName(name);
            }}
            hide={() => setMenu(false)}
            playing={playing}
            onGo={() => {
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
    </>
  );
};

export default Srn;
