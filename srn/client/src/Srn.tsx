import React, { Component, useEffect, useState } from 'react';
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

const ShipControls: React.FC<{
  state: GameState;
  mutate: (gs: GameState) => void;
}> = ({ state, mutate }) => {
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
        mutate(state);
      })();
    },
    [state]
  );

  return null;
};

class Srn extends React.Component<{}> {
  private NS: NetState;
  constructor(props: {}) {
    super(props);
    const NS = new NetState();
    NS.on('change', () => {
      console.log('changed!');
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
        <DebugState />
      </>
    );
  }
}

export default Srn;
