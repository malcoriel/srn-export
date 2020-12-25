import React from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './DebugStateLayer';
import { height_px, scaleConfig, width_px } from './common';
import { CoordLayer } from './CoordLayer';
import { PlanetsLayer } from './PlanetsLayer';
import { ShipsLayer } from './ShipsLayer';
import NetState from './NetState';
import { ShipControls } from './ShipControls';
import { CanvasHudLayer, HtmlHudLayer } from './CanvasHudLayer';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';

class Srn extends React.Component<
  {},
  { preferredName: string; ready: boolean }
> {
  private NS: NetState;
  constructor(props: {}) {
    super(props);
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
  }

  render() {
    return (
      <>
        <div style={{ padding: 5 }}>
          {this.state.ready && (
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <PlanetsLayer state={this.NS.state} />
              <ShipsLayer state={this.NS.state} />
              <CoordLayer />
              <CanvasHudLayer
                state={this.NS.state}
                connecting={this.NS.connecting}
              />
              <ShipControls mutate={this.NS.mutate} state={this.NS.state} />
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
      </>
    );
  }
}

export default Srn;
