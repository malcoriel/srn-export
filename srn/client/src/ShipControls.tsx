import React from 'react';
import { GameState, Ship, stateUrl } from './common';
import { useHotkeys } from 'react-hotkeys-hook';
import _ from 'lodash/fp';

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

const moveUp = (myShip: Ship) => {
  myShip.y -= 1;
  return myShip;
};
const moveDown = (myShip: Ship) => {
  myShip.y += 1;
  return myShip;
};
const moveLeft = (myShip: Ship) => {
  myShip.x -= 1;
  return myShip;
};
const moveRight = (myShip: Ship) => {
  myShip.x += 1;
  return myShip;
};

export const ShipControls: React.FC<{
  state: GameState;
  mutate: (gs: GameState) => void;
}> = ({ state, mutate }) => {
  const findMyShip = () => {
    let myShip: Ship;
    const myPlayer = state.players[0];
    if (!myPlayer) return null;

    const foundShip = state.ships.find((ship) => ship.id === myPlayer.ship_id);
    if (!foundShip) return null;
    myShip = foundShip;
    return myShip;
  };

  async function changeState(changer: (s: Ship) => void) {
    let myShip = findMyShip();
    if (!myShip) return null;
    changer(myShip);
    mutate(state);
    await updateServerState(state);
  }

  const controls = {
    w: moveUp,
    'w+a': _.compose(moveUp, moveLeft),
    s: moveDown,
    a: moveLeft,
    d: moveRight,
  };

  for (const [key, fn] of Object.entries(controls)) {
    useHotkeys(
      key,
      () => {
        (async () => {
          await changeState(fn);
        })();
      },
      [state]
    );
  }

  return null;
};
