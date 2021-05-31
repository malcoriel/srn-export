import React, { Suspense, useEffect, useState } from 'react';
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
import { MyTrajectoryLayer } from './KonvaLayers/MyTrajectoryLayer';
import { HelpWindow } from './HtmlLayers/HelpWindow';
import './HtmlLayers/Panel.scss';
import { MinimapPanel } from './KonvaLayers/MinimapPanel';
import 'react-jinke-music-player/assets/index.css';
import { MusicControls } from './MusicControls';
import { SrnState, useStore, WindowState } from './store';
import { ControlPanel } from './HtmlLayers/ControlPanel';
import { QuestWindow } from './HtmlLayers/QuestWindow';
import { WindowContainers } from './HtmlLayers/WindowContainers';
import { OverheadPanel } from './HtmlLayers/OverheadPanel';
import { HoverHintWindow } from './HtmlLayers/HoverHintWindow';
import { size } from './coord';
import { ChatState } from './ChatState';
import { ChatWindow } from './HtmlLayers/ChatWindow';
import { InventoryWindow } from './HtmlLayers/InventoryWindow';
import { DialogueWindow } from './HtmlLayers/DialogueWindow';
import { GameMode } from './world';
import { SandboxQuickMenu } from './HtmlLayers/SandboxQuickMenu';
import { TradeWindow } from './HtmlLayers/TradeWindow';
import { PromptWindow } from './HtmlLayers/PromptWindow';
import { useResourcesLoading } from './utils/useResourcesLoading';
import { StarMapWindow } from './HtmlLayers/StarMapWindow';
import { LongActionsDisplay } from './HtmlLayers/LongActionsDisplay';
import { StartMenuBackground } from './StartMenuBackground';
import { GlobalContextMenu } from './ThreeLayers/blocks/ThreeInteractor';

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
        if (playing) {
          toggleMenu();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [playing, toggleMenu]
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

  const [resourcesAreLoading, formattedProgress] = useResourcesLoading(() => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (ns) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      ns.sendRoomJoin();
    }
  });

  const quit = () => {
    const ns = NetState.get();
    if (!ns) return;
    ns.disconnectAndDestroy();
    setPlaying(false);
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
      <Suspense fallback={<div />}>
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
              <ThreeLayer visible={!resourcesAreLoading} />
              {resourcesAreLoading && (
                <div className="three-loader">
                  <div className="loader ball-clip-rotate-multiple">
                    <div />
                    <div />
                  </div>
                  <div className="text">Loading: {formattedProgress}</div>
                </div>
              )}
              {!resourcesAreLoading && (
                <Stage
                  width={size.width_px}
                  height={size.height_px}
                  style={{ pointerEvents: 'none' }}
                >
                  <KonvaOverlay />
                  <MyTrajectoryLayer />
                </Stage>
              )}
              {!resourcesAreLoading && (
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
                  <HoverHintWindow />
                  <PromptWindow />
                  <GlobalContextMenu />
                  {playing && <SandboxQuickMenu />}
                </>
              )}
            </>
          )}
          {musicEnabled && <MusicControls />}
          {menu && (
            <StartMenu
              seed={seed}
              locationSeed={locationSeed}
              start={() => start(GameMode.CargoRush)}
              quit={quit}
              startTutorial={() => start(GameMode.Tutorial)}
              startSandbox={() => start(GameMode.Sandbox)}
            />
          )}
          {!playing && <StartMenuBackground />}
        </div>
      </Suspense>
    </>
  );
};

export default Srn;
