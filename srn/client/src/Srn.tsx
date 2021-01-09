import React from 'react';
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

class Srn extends React.Component<
  {},
  {
    preferredName: string;
    playing: boolean;
    menu: boolean;
    musicEnabled: boolean;
    portraitIndex: number;
    portrait: string;
  }
> {
  private readonly id: string;
  private monitorSizeInterval?: Timeout;
  constructor(props: {}) {
    super(props);
    this.id = uuid.v4();
    let portraitIndex = randBetweenExclusiveEnd(0, portraits.length);
    this.state = {
      playing: false,
      menu: true,
      preferredName: genRandomName(),
      musicEnabled: true,
      portraitIndex: portraitIndex,
      portrait: Srn.portraitPath(portraitIndex),
    };
  }

  nextPortrait = () => {
    let portraitIndex = (this.state.portraitIndex + 1) % portraits.length;
    let portrait = Srn.portraitPath(portraitIndex);
    this.setState({ portraitIndex, portrait });
  };

  private static portraitPath(portraitIndex: number) {
    return `resources/chars/${portraits[portraitIndex]}`;
  }

  previousPortrait = () => {
    let number = this.state.portraitIndex - 1;
    if (number < 0) number = portraits.length + number;
    let portraitIndex = number % portraits.length;
    let portrait = Srn.portraitPath(portraitIndex);
    this.setState({
      portraitIndex,
      portrait,
    });
  };

  componentDidMount() {
    NetState.make();
    const ns = NetState.get();
    if (!ns) return;

    this.monitorSizeInterval = setInterval(
      this.updateSize,
      MONITOR_SIZE_INTERVAL
    );
  }

  updateSize = () => {
    size.width_px = window.innerWidth;
    size.height_px = window.innerHeight;
    this.forceUpdate();
  };

  componentWillUnmount() {
    const ns = NetState.get();
    if (!ns) return;

    if (this.monitorSizeInterval) {
      clearInterval(this.monitorSizeInterval);
    }
    Perf.stop();
    ns.disconnect();
  }

  start() {
    if (!NetState.get()) {
      NetState.make();
    }

    const ns = NetState.get();

    if (!ns) {
      return;
    }

    ns.on('change', () => {
      this.forceUpdate();
    });
    ns.on('network', () => {
      this.forceUpdate();
    });

    ns.playerName = this.state.preferredName;
    ns.portraitIndex = this.state.portraitIndex + 1; // portrait files are 1-based
    ns.disconnecting = false;
    ns.connect();
  }

  quit = () => {
    const ns = NetState.get();
    if (!ns) return;
    ns.disconnect();
    this.setState({ playing: false });
  };

  render() {
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
          {this.state.playing && (
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
          {this.state.musicEnabled && <MusicControls />}
          <DialoguePanel />
          {this.state.playing && (
            <HotkeyWrapper
              hotkey="esc"
              onPress={() => {
                this.setState({ menu: !this.state.menu });
              }}
            />
          )}
          {this.state.menu && (
            <MainMenuLayer
              nextPortrait={this.nextPortrait}
              previousPortrait={this.previousPortrait}
              portrait={this.state.portrait}
              makeRandomName={() => {
                this.setState({ preferredName: genRandomName() });
              }}
              musicEnabled={this.state.musicEnabled}
              onPreferredNameChange={(name) =>
                this.setState({ preferredName: name })
              }
              hide={() => this.setState({ menu: false })}
              playing={this.state.playing}
              onSetMusic={(value) => {
                this.setState({ musicEnabled: value });
              }}
              onGo={() => {
                this.setState({ playing: true, menu: false });
                this.start();
              }}
              preferredName={this.state.preferredName}
              makeRandomPortrait={() => {
                let portraitIndex = randBetweenExclusiveEnd(
                  0,
                  portraits.length
                );
                this.setState({
                  portraitIndex: portraitIndex,
                  portrait: Srn.portraitPath(portraitIndex),
                });
              }}
              quit={this.quit}
            />
          )}
        </div>
        <DebugStateLayer />
        <StatsPanel />
      </>
    );
  }
}

export default Srn;
