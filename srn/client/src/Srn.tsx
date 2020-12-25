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
import NetState from './NetState';

const shiftShip = (ship: Ship): void => {
  if (ship) {
    ship.x += 1;
  }
};

const updateServerState = (state: GameState) => {
  if (state) {
    let content = JSON.stringify(state);
    return fetch(stateUrl, {
      method: 'POST',
      headers: {
        'Content-Length': `${content.length}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      redirect: 'follow',
      body: content,
    });
  }
};

const ShipControls = () => {
  const { data: state } = useSWR<GameState>(stateUrl);

  useHotkeys(
    'w',
    () => {
      (async function () {
        console.log('hotkey');
        if (!state) {
          console.log('no state');
          return;
        }
        let myShip: Ship;
        const myPlayer = state.players[0];
        if (!myPlayer) return null;

        const foundShip = state.ships.find(
          (ship) => ship.id === myPlayer.ship_id
        );
        if (!foundShip) return null;
        myShip = foundShip;

        shiftShip(myShip);
        await updateServerState(state);
        mutate(stateUrl, state, true);
      })();
    },
    [state]
  );

  return null;
};

class Srn extends Component {
  render() {
    return (
      <SWRConfig
        value={{
          refreshInterval: 10000,
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

const NS = new NetState();
NS.connect();
// @ts-ignore
window.send = NS.send.bind(NS);

export default Srn;
