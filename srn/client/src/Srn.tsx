import React, { Component, useEffect } from 'react';
import { Stage } from 'react-konva';
import useSWR, { SWRConfig, mutate } from 'swr';
import 'reset-css';
import './index.css';
import { DebugState } from './DebugState';
import {
  GameState,
  height_px,
  scaleConfig,
  Ship,
  stateUrl,
  width_px,
} from './common';
import { CoordLayer } from './CoordLayer';
import { PlanetsLayer } from './PlanetsLayer';
import { ShipsLayer } from './ShipsLayer';
import { useHotkeys } from 'react-hotkeys-hook';

const shiftShip = (ship: Ship): void => {
  ship.x += 1;
};

const ShipControls = () => {
  let myShip: Ship;
  let state: GameState;
  useHotkeys('w', () => {
    shiftShip(myShip);
    mutate(stateUrl, state, false);
  });

  const { data } = useSWR<GameState>(stateUrl);
  if (!data) return null;
  state = data;
  const myPlayer = state.players[0];
  if (!myPlayer) return null;

  const foundShip = state.ships.find((ship) => ship.id === myPlayer.ship_id);
  if (!foundShip) return null;
  myShip = foundShip;

  useHotkeys('a', () => {});
  useHotkeys('s', () => {});
  useHotkeys('d', () => {});
  return null;
};

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
              <ShipControls />
            </Stage>
          </div>
          <DebugState />
        </>
      </SWRConfig>
    );
  }
}

export default Srn;
