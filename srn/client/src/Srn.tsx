import React from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './HtmlLayers/DebugStateLayer';
import { height_px, scaleConfig, width_px } from './world';
import { CoordLayer } from './KonvaLayers/CoordLayer';
import NetState from './NetState';
import { ShipControls } from './utils/ShipControls';
import { GameHTMLHudLayer } from './HtmlLayers/GameHTMLHudLayer';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Measure, Perf, statsHeap, StatsPanel } from './HtmlLayers/Perf';
import { vsyncedDecoupledTime } from './utils/Times';
import { StartHudLayer } from './HtmlLayers/StartHudLayer';
import { LeaderboardLayer } from './HtmlLayers/LeaderboardLayer';
import { ThreeLayer } from './ThreeLayers/ThreeLayer';
import { NamesLayer } from './KonvaLayers/NamesLayer';
import * as uuid from 'uuid';
import { MyTrajectoryLayer } from './KonvaLayers/MyTrajectoryLayer';

const LOCAL_SIM_TIME_STEP = Math.floor(1000 / 30);

statsHeap.timeStep = LOCAL_SIM_TIME_STEP;

class Srn extends React.Component<
  {},
  { preferredName: string; ready: boolean }
> {
  private time: vsyncedDecoupledTime;
  private readonly id: string;
  constructor(props: {}) {
    super(props);
    this.id = uuid.v4();
    this.time = new vsyncedDecoupledTime(LOCAL_SIM_TIME_STEP);
    this.state = {
      ready: true,
      preferredName: uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
      }).toUpperCase(),
    };
  }

  componentDidMount() {
    NetState.make();
    const ns = NetState.get();
    if (!ns) return;

    ns.on('change', () => {
      this.forceUpdate();
    });
    ns.on('network', () => {
      this.forceUpdate();
    });
    this.start();
  }

  componentWillUnmount() {
    const ns = NetState.get();
    if (!ns) return;

    this.time.clearAnimation();
    Perf.stop();
    ns.disconnect();
  }

  start() {
    const ns = NetState.get();
    if (!ns) return;

    ns.preferredName = this.state.preferredName;
    ns.connect();
    Perf.start();
    this.time.setInterval(
      (elapsedMs) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;
          ns.updateLocalState(elapsedMs);
        });
      },
      () => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          const ns = NetState.get();
          if (!ns) return;

          ns.emit('change');
        });
      }
    );
  }

  render() {
    return (
      <>
        <div
          style={{
            padding: 5,
            margin: 5,
            position: 'relative',
            backgroundColor: 'black',
            width: width_px,
            height: height_px,
          }}
        >
          {this.state.ready && <ThreeLayer />}
          {this.state.ready && (
            <Stage
              width={width_px}
              height={height_px}
              {...scaleConfig}
              style={{ pointerEvents: 'none' }}
            >
              <NamesLayer />
              <MyTrajectoryLayer />
              <CoordLayer />
            </Stage>
          )}
          <ShipControls />
          <GameHTMLHudLayer />
        </div>
        {!this.state.ready && (
          <StartHudLayer
            onPreferredNameChange={(name) =>
              this.setState({ preferredName: name })
            }
            onGo={() => {
              this.setState({ ready: true });
              this.start();
            }}
            preferredName={this.state.preferredName}
          />
        )}
        <LeaderboardLayer />
        <DebugStateLayer />
        <StatsPanel />
      </>
    );
  }
}

export default Srn;
