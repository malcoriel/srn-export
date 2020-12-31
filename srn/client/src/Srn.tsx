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
import { BasicTime, vsyncedDecoupledTime as Time } from './utils/Times';
import { StartHudLayer } from './HtmlLayers/StartHudLayer';
import { LeaderboardLayer } from './HtmlLayers/LeaderboardLayer';
import { ThreeLayer } from './ThreeLayers/ThreeLayer';
import { IVector } from './utils/Vector';
import { NamesLayer } from './KonvaLayers/NamesLayer';

const LOCAL_SIM_TIME_STEP = Math.floor(1000 / 30);

statsHeap.timeStep = LOCAL_SIM_TIME_STEP;

class Srn extends React.Component<
  {},
  { preferredName: string; ready: boolean }
> {
  private time: BasicTime;
  constructor(props: {}) {
    super(props);
    this.time = new Time(LOCAL_SIM_TIME_STEP);

    NetState.get().on('change', () => {
      this.forceUpdate();
    });
    NetState.get().on('network', () => {
      this.forceUpdate();
    });
    this.state = {
      ready: true,
      preferredName: uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
      }).toUpperCase(),
    };
    this.start();
  }

  start() {
    NetState.get().preferredName = this.state.preferredName;
    NetState.get().connect();
    Perf.start();
    this.time.setInterval(
      (elapsedMs) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          NetState.get().updateLocalState(elapsedMs);
        });
      },
      () => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          NetState.get().emit('change');
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
              <NamesLayer
                state={NetState.get().state}
                visualState={NetState.get().visualState}
              />
              <CoordLayer />
            </Stage>
          )}
          <ShipControls />
          <GameHTMLHudLayer
            style={{ pointerEvents: 'none' }}
            state={NetState.get().state}
            ping={NetState.get().ping}
            maxPing={NetState.get().maxPing}
            connecting={NetState.get().connecting}
          />
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
        {NetState.get().state.leaderboard && (
          <LeaderboardLayer
            leaderboard={NetState.get().state.leaderboard}
            milliseconds_remaining={NetState.get().state.milliseconds_remaining}
          />
        )}
        <DebugStateLayer state={NetState.get().state} />
        <StatsPanel />
      </>
    );
  }
}

export default Srn;
