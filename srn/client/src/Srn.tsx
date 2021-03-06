import React, { useEffect, useState } from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.scss';
import { DebugStateLayer } from './HtmlLayers/DebugStateLayer';
import NetState, { Timeout } from './NetState';
import { ShipControls } from './utils/ShipControls';
import { NetworkStatus } from './HtmlLayers/NetworkStatus';
import { Measure, Perf, StatsPanel } from './HtmlLayers/Perf';
import { StartMenu } from './HtmlLayers/StartMenu';
import { LeaderboardWindow } from './HtmlLayers/LeaderboardWindow';
import { ThreeLayer } from './ThreeLayers/ThreeLayer';
import { KonvaOverlay } from './KonvaLayers/KonvaOverlay';
import { MyTrajectoryLayer } from './KonvaLayers/MyTrajectoryLayer';
import { HelpWindow } from './HtmlLayers/HelpWindow';
import './HtmlLayers/Panel.scss';
import { MinimapPanel } from './KonvaLayers/MinimapPanel';
import 'react-jinke-music-player/assets/index.css';
import { MusicControls } from './MusicControls';
import { HotkeyWrapper } from './HotkeyWrapper';
import { SrnState, useStore, WindowState } from './store';
import { ControlPanel } from './HtmlLayers/ControlPanel';
import { QuestWindow } from './HtmlLayers/QuestWindow';
import { WindowContainers } from './HtmlLayers/WindowContainers';
import shallow from 'zustand/shallow';
import { OverheadPanel } from './HtmlLayers/OverheadPanel';
import { TestUI } from './HtmlLayers/TestUI';
import { HoverHintWindow } from './HtmlLayers/HoverHintWindow';
import { size } from './coord';
import { ChatState } from './ChatState';
import { ChatWindow } from './HtmlLayers/ChatWindow';
import { InventoryWindow } from './HtmlLayers/InventoryWindow';
import { DialogueWindow } from './HtmlLayers/DialogueWindow';
import { GameMode } from './world';

const MONITOR_SIZE_INTERVAL = 1000;
let monitorSizeInterval: Timeout | undefined;

const Srn = () => {
  Perf.markEvent(Measure.RootComponentRender);
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
    setChatWindow,
    setLeaderboardWindow,
  } = useStore(
    (state: SrnState) => ({
      playing: state.playing,
      setPlaying: state.setPlaying,
      menu: state.menu,
      setMenu: state.setMenu,
      toggleMenu: state.toggleMenu,
      preferredName: state.preferredName,
      portrait: state.portrait,
      musicEnabled: state.musicEnabled,
      forceUpdate: state.forceUpdate,
      setChatWindow: state.setChatWindow,
      setLeaderboardWindow: state.setLeaderboardWindow,
    }),
    shallow,
  );
  useStore((state) => state.trigger);

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

  const [mode, setMode] = useState(GameMode.CargoRush);

  useEffect(() => {
    if (!NetState.get()) {
      NetState.make();
    }
    if (!ChatState.get()) {
      ChatState.make();
    }

    const ns = NetState.get();
    if (!ns) return;

    const cs = ChatState.get();
    if (!cs) return;
    cs.tryConnect(preferredName);

    monitorSizeInterval = setInterval(updateSize, MONITOR_SIZE_INTERVAL);

    if (playing) {
      console.log('remount start');
      start(mode);
      // this will force re-subscription to useNSForceChange
      forceUpdate();
    }
    return () => {
      console.log('unmounting srn...');
      if (monitorSizeInterval) {
        clearInterval(monitorSizeInterval);
      }
      Perf.stop();

      const ns = NetState.get();
      if (ns) {
        ns.disconnectAndDestroy();
      }
      const cs = ChatState.get();
      if (cs) {
        cs.tryDisconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (mode: GameMode) => {
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
    setMode(mode);
    ns.init(mode);
    ns.on('disconnect', () => {
      setPlaying(false);
      setMenu(true);
    });
    if (mode === GameMode.Tutorial) {
      setChatWindow(WindowState.Hidden);
      setLeaderboardWindow(WindowState.Hidden);
    } else {
      setChatWindow(WindowState.Minimized);
      setLeaderboardWindow(WindowState.Minimized);
    }
  };

  const quit = () => {
    const ns = NetState.get();
    if (!ns) return;
    ns.disconnectAndDestroy();
    setPlaying(false);
  };

  let ns = NetState.get();
  const seed = ns ? ns.state.seed : '';

  return (
    <>
      <div
        className='main-container'
        style={{
          position: 'relative',
          width: size.width_px,
          height: size.height_px,
        }}
      >
        {playing && (
          <>
            <MinimapPanel />
            <ThreeLayer />
            <Stage
              width={size.width_px}
              height={size.height_px}
              style={{ pointerEvents: 'none' }}
            >
              <KonvaOverlay />
              <MyTrajectoryLayer />
            </Stage>
            <ShipControls />
            <NetworkStatus />
            <LeaderboardWindow />
            <DialogueWindow />
            <QuestWindow />
            <ChatWindow />
            <HotkeyWrapper
              hotkey='esc'
              onPress={() => {
                toggleMenu();
              }}
            />
            <DebugStateLayer />
            <StatsPanel />
            <ControlPanel />
            <WindowContainers />
            <OverheadPanel />
            <HelpWindow />
            <InventoryWindow />
            {/*<TradeWindow />*/}
            <HoverHintWindow />
          </>
        )}
        {!playing && <TestUI />}
        {musicEnabled && <MusicControls />}
        {menu && <StartMenu
          seed={seed}
          start={() => start(GameMode.CargoRush)}
          quit={quit}
          startTutorial={() => start(GameMode.Tutorial)}
          startSandbox={() => start(GameMode.Sandbox)}
        />}
      </div>
    </>
  );
};

export default Srn;
