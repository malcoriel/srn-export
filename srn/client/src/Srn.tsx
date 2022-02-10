import React, { useEffect, useState } from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.scss';
import './ThreeLayers/ThreeLoader.scss';
import shallow from 'zustand/shallow';
import { useHotkeys } from 'react-hotkeys-hook';
import { DebugStateLayer } from './HtmlLayers/DebugStateLayer';
import NetState, { Timeout } from './NetState';
import { ShipControls } from './utils/ShipControls';
import { NetworkStatus } from './HtmlLayers/NetworkStatus';
import { Measure, Perf, StatsPanel } from './HtmlLayers/Perf';
import { StartMenu } from './HtmlLayers/StartMenu';
import { LeaderboardWindow } from './HtmlLayers/LeaderboardWindow';
import { ThreeLayer } from './ThreeLayers/ThreeLayer';
import { KonvaOverlay } from './KonvaLayers/KonvaOverlay';
import { HelpWindow } from './HtmlLayers/HelpWindow';
import './HtmlLayers/Panel.scss';
import { MinimapPanel } from './KonvaLayers/MinimapPanel';
import 'react-jinke-music-player/assets/index.css';
import { MusicControls } from './MusicControls';
import { MainUiState, SrnState, useStore, WindowState } from './store';
import { ControlPanel } from './HtmlLayers/ControlPanel';
import { QuestWindow } from './HtmlLayers/QuestWindow';
import { WindowContainers } from './HtmlLayers/WindowContainers';
import { OverheadPanel } from './HtmlLayers/OverheadPanel';
import { size } from './coord';
import { ChatState } from './ChatState';
import { ChatWindow } from './HtmlLayers/ChatWindow';
import { InventoryWindow } from './HtmlLayers/InventoryWindow';
import { DialogueWindow } from './HtmlLayers/DialogueWindow';
import { GameMode } from './world';
import { SandboxQuickMenu } from './HtmlLayers/SandboxQuickMenu';
import { TradeWindow } from './HtmlLayers/TradeWindow';
import { PromptWindow } from './HtmlLayers/PromptWindow';
import { StarMapWindow } from './HtmlLayers/StarMapWindow';
import { LongActionsDisplay } from './HtmlLayers/LongActionsDisplay';
import { StartMenuBackground } from './StartMenuBackground';
import { StateStoreSyncer } from './StateStoreSyncer';
import {
  MenuLoadingIndicator,
  SuspendedPreloader,
} from './ThreeLayers/Resources';

const MONITOR_SIZE_INTERVAL = 1000;
let monitorSizeInterval: Timeout | undefined;

const Srn = () => {
  Perf.markEvent(Measure.RootComponentRender);
  const {
    mainUiState,
    setMainUiState,
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
      mainUiState: state.mainUiState,
      setMainUiState: state.setMainUiState,
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
    shallow
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

  useHotkeys(
    'esc',
    () => {
      try {
        if (mainUiState) {
          toggleMenu();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [mainUiState, toggleMenu]
  );

  const [mode, setMode] = useState(GameMode.CargoRush);

  const start = (mode: GameMode) => {
    if (!NetState.get()) {
      NetState.make();
    }
    const ns = NetState.get();

    if (!ns) {
      return;
    }

    setMainUiState(MainUiState.Playing);
    setMenu(false);
    ns.playerName = preferredName;
    ns.portraitName = portrait; // portrait files are 1-based
    ns.disconnecting = false;
    setMode(mode);
    ns.init(mode);
    ns.on('disconnect', () => {
      setMainUiState(MainUiState.Idle);
      setMenu(true);
    });
    if (mode === GameMode.Tutorial) {
      setChatWindow(WindowState.Hidden);
      setLeaderboardWindow(WindowState.Hidden);
    } else {
      setChatWindow(WindowState.Minimized);
      setLeaderboardWindow(WindowState.Hidden);
    }
  };

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

    // chrome has 1px height bug that needs to be fixed on load
    updateSize();
    monitorSizeInterval = setInterval(updateSize, MONITOR_SIZE_INTERVAL);

    if (mainUiState === MainUiState.Playing) {
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

  const quit = () => {
    const ns = NetState.get();
    if (!ns) return;
    ns.disconnectAndDestroy();
    setMainUiState(MainUiState.Idle);
  };

  const ns = NetState.get();
  let seed = '???';
  let locationSeed = '???';
  if (ns) {
    const { state } = ns;
    seed = state.seed;
    if (state.locations.length > 0) {
      locationSeed = state.locations[0].seed;
    }
  }

  return (
    <>
      <SuspendedPreloader />
      <div
        id="main-container"
        className="main-container"
        style={{
          position: 'relative',
          width: size.width_px,
          height: size.height_px,
        }}
      >
        {mainUiState === MainUiState.Playing ? (
          <>
            <ThreeLayer visible desiredMode={mode} />

            <Stage
              width={size.width_px}
              height={size.height_px}
              style={{ pointerEvents: 'none' }}
            >
              <KonvaOverlay />
            </Stage>
            <>
              <MinimapPanel />
              <ShipControls />
              <NetworkStatus />
              <LeaderboardWindow />
              <DialogueWindow />
              <QuestWindow />
              <ChatWindow />
              <DebugStateLayer />
              <StatsPanel />
              <ControlPanel />
              <WindowContainers />
              <OverheadPanel />
              <HelpWindow />
              <InventoryWindow />
              <LongActionsDisplay />
              <StarMapWindow />
              <TradeWindow />
              <PromptWindow />
              <StateStoreSyncer />
              <SandboxQuickMenu />
            </>
          </>
        ) : null}
        {musicEnabled && <MusicControls />}
        {menu && (
          <StartMenu
            seed={seed}
            locationSeed={locationSeed}
            start={start}
            quit={quit}
          />
        )}
        {mainUiState === MainUiState.Idle && <StartMenuBackground />}
        {mainUiState === MainUiState.Idle && <MenuLoadingIndicator />}
      </div>
    </>
  );
};

export default Srn;
