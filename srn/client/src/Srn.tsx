import React from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './DebugStateLayer';
import { height_px, scaleConfig, width_px } from './world';
import { CoordLayer } from './CoordLayer';
import { BodiesLayer } from './BodiesLayer';
import { ShipsLayer } from './ShipsLayer';
import NetState from './NetState';
import { ShipControls } from './ShipControls';
import { GameHTMLHudLayer } from './GameHTMLHudLayer';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Measure, Perf, statsHeap, StatsPanel } from './Perf';
import { BasicTime, vsyncedDecoupledTime as Time } from './Times';
import { StartHudLayer } from './StartHudLayer';
import { LeaderboardLayer } from './LeaderboardLayer';

const LOCAL_SIM_TIME_STEP = Math.floor(1000 / 30);

statsHeap.timeStep = LOCAL_SIM_TIME_STEP;

class Srn extends React.Component<
  {},
  { preferredName: string; ready: boolean }
> {
  private NS: NetState;
  private time: BasicTime;
  constructor(props: {}) {
    super(props);
    this.time = new Time(LOCAL_SIM_TIME_STEP);
    const NS = new NetState();
    NS.on('change', () => {
      this.forceUpdate();
    });
    NS.on('network', () => {
      this.forceUpdate();
    });
    this.NS = NS;
    this.state = {
      ready: false,
      preferredName: uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
      }).toUpperCase(),
    };
  }

  start() {
    this.NS.preferredName = this.state.preferredName;
    this.NS.connect();
    Perf.start();
    this.time.setInterval(
      (elapsedMs) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          this.NS.updateLocalState(elapsedMs);
        });
      },
      () => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          this.NS.emit('change');
        });
      }
    );
  }

  render() {
    return (
      <>
        <div style={{ padding: 5, position: 'relative' }}>
          {this.state.ready && (
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <BodiesLayer state={this.NS.state} />
              <ShipsLayer state={this.NS.state} />
              <CoordLayer />
              <ShipControls />
            </Stage>
          )}
          <GameHTMLHudLayer
            state={this.NS.state}
            ping={this.NS.ping}
            maxPing={this.NS.maxPing}
            connecting={this.NS.connecting}
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
        {this.NS.state.leaderboard && (
          <LeaderboardLayer
            leaderboard={this.NS.state.leaderboard}
            milliseconds_remaining={this.NS.state.milliseconds_remaining}
          />
        )}
        <DebugStateLayer state={this.NS.state} />
        <StatsPanel />
      </>
    );
  }
}

export default Srn;
