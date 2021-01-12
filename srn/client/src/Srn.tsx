import React, { useEffect } from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './HtmlLayers/DebugStateLayer';
import { scaleConfig, size } from './world';
import { CoordLayer } from './KonvaLayers/CoordLayer';
import NetState, { Timeout } from './NetState';
import { ShipControls } from './utils/ShipControls';
import { NetworkStatus } from './HtmlLayers/NetworkStatus';
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
import 'react-jinke-music-player/assets/index.css';
import { DialoguePanel } from './HtmlLayers/DialoguePanel';
import { MusicControls } from './MusicControls';
import { HotkeyWrapper } from './HotkeyWrapper';
import { SrnState, useStore } from './store';
import { ControlPanel } from './HtmlLayers/ControlPanel';
import { QuestWindow } from './HtmlLayers/QuestWindow';
import { MinimizedWindows } from './HtmlLayers/MinimizedWindows';

const MONITOR_SIZE_INTERVAL = 1000;
let monitorSizeInterval: Timeout | undefined;

const Srn = () => {
  const {
    playing,
    setPlaying,
    menu,
    setMenu,
    toggleMenu,
    preferredName,
    portrait,
    musicEnabled,
    forceUpdate,
  } = useStore((state: SrnState) => ({
    playing: state.playing,
    setPlaying: state.setPlaying,
    menu: state.menu,
    setMenu: state.setMenu,
    toggleMenu: state.toggleMenu,
    preferredName: state.preferredName,
    portrait: state.portrait,
    musicEnabled: state.musicEnabled,
    forceUpdate: state.forceUpdate,
  }));

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
    // ns.on('network', () => {
    //   forceUpdate();
    // });
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
            <NetworkStatus />
            <InGameLeaderBoardPanel />
            <HelpLayer />
            <LeaderboardLayer />
            <DialoguePanel />
            <QuestWindow />
            <HotkeyWrapper
              hotkey="esc"
              onPress={() => {
                toggleMenu();
              }}
            />
            <DebugStateLayer />
            <StatsPanel />
            <ControlPanel />
            <MinimizedWindows />
          </>
        )}
        {musicEnabled && <MusicControls />}
        {menu && <StartMenu start={start} quit={quit} />}
      </div>
    </>
  );
};

export default Srn;
