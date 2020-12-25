import React from 'react';
import { GameState, Ship } from './common';
import { useHotkeys } from 'react-hotkeys-hook';
import _ from 'lodash/fp';

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
    const myPlayer = state.players.find((player) => player.id === state.my_id);
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
  }

  const controls = {
    w: moveUp,
    'w+a': _.compose(moveUp, moveLeft),
    s: moveDown,
    's+a': _.compose(moveDown, moveLeft),
    a: moveLeft,
    's+d': _.compose(moveDown, moveRight),
    d: moveRight,
    'w+d': _.compose(moveUp, moveRight),
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
