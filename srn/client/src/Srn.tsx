import React from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugState } from './DebugState';
import { height_px, scaleConfig, width_px } from './common';
import { CoordLayer } from './CoordLayer';
import { PlanetsLayer } from './PlanetsLayer';
import { ShipsLayer } from './ShipsLayer';
import NetState from './NetState';
import { ShipControls } from './ShipControls';

class Srn extends React.Component<{}> {
  private NS: NetState;
  constructor(props: {}) {
    super(props);
    const NS = new NetState();
    NS.on('change', () => {
      this.forceUpdate();
    });
    NS.connect();
    this.NS = NS;
  }

  render() {
    return (
      <>
        <div style={{ padding: 5 }}>
          <Stage width={width_px} height={height_px} {...scaleConfig}>
            <PlanetsLayer state={this.NS.state} />
            <ShipsLayer state={this.NS.state} />
            <CoordLayer />
            <ShipControls mutate={this.NS.mutate} state={this.NS.state} />
          </Stage>
        </div>
        <DebugState state={this.NS.state} />
      </>
    );
  }
}

export default Srn;
