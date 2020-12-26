import React from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './DebugStateLayer';
import { height_px, scaleConfig, width_px } from './common';
import { CoordLayer } from './CoordLayer';
import { BodiesLayer } from './BodiesLayer';
import { ShipsLayer } from './ShipsLayer';
import NetState from './NetState';
import { ShipControls } from './ShipControls';
import { CanvasHudLayer, HtmlHudLayer } from './CanvasHudLayer';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Measure, Perf, statsHeap, StatsPanel } from './Perf';
import { BasicTime, decoupledLockedTime } from './Times';

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
    this.time = new decoupledLockedTime(LOCAL_SIM_TIME_STEP);
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
      (elapsedMs) => {
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
        <div style={{ padding: 5 }}>
          {this.state.ready && (
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <BodiesLayer state={this.NS.state} />
              <ShipsLayer state={this.NS.state} />
              <CoordLayer />
              <CanvasHudLayer
                state={this.NS.state}
                connecting={this.NS.connecting}
              />
              <ShipControls
                mutate_ship={this.NS.mutate_ship}
                state={this.NS.state}
              />
            </Stage>
          )}
        </div>
        {!this.state.ready && (
          <HtmlHudLayer
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
        <DebugStateLayer state={this.NS.state} />
        <StatsPanel />
      </>
    );
  }
}

export default Srn;
