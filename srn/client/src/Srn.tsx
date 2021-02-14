import React, { useEffect } from 'react';
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
import { DialoguePanel } from './HtmlLayers/DialoguePanel';
import { MusicControls } from './MusicControls';
import { HotkeyWrapper } from './HotkeyWrapper';
import { SrnState, useStore } from './store';
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
import { TradeWindow } from './HtmlLayers/TradeWindow';
import { InventoryWindow } from './HtmlLayers/InventoryWindow';

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
      start();
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
    ns.init();
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
        className="main-container"
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
            <DialoguePanel />
            <QuestWindow />
            <ChatWindow />
            <HotkeyWrapper
              hotkey="esc"
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
        {menu && <StartMenu seed={seed} start={start} quit={quit} />}
      </div>
    </>
  );
};

export default Srn;
