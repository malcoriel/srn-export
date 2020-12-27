import React from 'react';
import { GameState, Ship } from './world';
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

export type ShipChanger = (s: Ship) => Ship;
export type ShipChangerCallback = (changer: ShipChanger) => void;
export const ShipControls: React.FC<{
  state: GameState;
  mutate_ship: ShipChangerCallback;
}> = ({ state, mutate_ship }) => {
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
          await mutate_ship(fn);
        })();
      },
      [state]
    );
  }

  return null;
};
