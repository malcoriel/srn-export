import React, { Component } from 'react';
import { Stage } from 'react-konva';
import { SWRConfig } from 'swr';
import 'reset-css';
import './index.css';
import { DebugState } from './DebugState';
import { height_px, scaleConfig, width_px } from './common';
import { CoordLayer } from './CoordLayer';
import { PlanetsLayer } from './PlanetsLayer';
import { ShipsLayer } from './ShipsLayer';

class Srn extends Component {
  render() {
    return (
      <SWRConfig
        value={{
          refreshInterval: 1000,
          fetcher: (url, init) => fetch(url, init).then((res) => res.json()),
        }}
      >
        <>
          <div style={{ padding: 5 }}>
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <PlanetsLayer />
              <ShipsLayer />
              <CoordLayer />
            </Stage>
          </div>
          <DebugState />
        </>
      </SWRConfig>
    );
  }
}

export default Srn;
