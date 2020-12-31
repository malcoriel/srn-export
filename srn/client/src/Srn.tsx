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
      ready: true,
      preferredName: uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
      }).toUpperCase(),
    };
    this.start();
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

  onChangeCamera = (position: IVector) => {
    this.NS.visualState.cameraPosition = position;
  };

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
          {this.state.ready && (
            <ThreeLayer
              state={this.NS.state}
              onChangeCamera={this.onChangeCamera}
            />
          )}
          {this.state.ready && (
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <NamesLayer
                state={this.NS.state}
                visualState={this.NS.visualState}
              />
              <CoordLayer />
            </Stage>
          )}
          <ShipControls />
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
