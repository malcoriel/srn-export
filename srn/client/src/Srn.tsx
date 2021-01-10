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
import { Perf, StatsPanel } from './HtmlLayers/Perf';
import { StartMenu } from './HtmlLayers/StartMenu';
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
import { HotkeyWrapper } from './HotkeyWrapper';
import { SrnState, useStore } from './store';

const MONITOR_SIZE_INTERVAL = 1000;
let monitorSizeInterval: Timeout | undefined;

const Srn = () => {
  const {
    playing,
    setPlaying,
    menu,
    setMenu,
    preferredName,
    portrait,
    musicEnabled,
    forceUpdate,
  } = useStore((state: SrnState) => ({ ...state }));

  const updateSize = () => {
    if (
      size.width_px !== window.innerWidth ||
      size.height_px !== window.innerHeight
    ) {
      size.width_px = window.innerWidth;
      size.height_px = window.innerHeight;
      forceUpdate();
    }
  };

  useEffect(() => {
    if (!NetState.get()) {
      NetState.make();
    }
    const ns = NetState.get();
    if (!ns) return;

    monitorSizeInterval = setInterval(updateSize, MONITOR_SIZE_INTERVAL);

    if (playing) {
      console.log('remount start');
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
    ns.portraitName = portrait; // portrait files are 1-based
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
        {menu && <StartMenu start={start} quit={quit} />}
      </div>
    </>
  );
};

export default Srn;
