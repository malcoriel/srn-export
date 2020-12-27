import React from 'react';
import { Direction, GameState, ShipAction } from './world';
import { useHotkeys } from 'react-hotkeys-hook';

export type ShipChangerCallback = (sa: ShipAction) => void;
export const ShipControls: React.FC<{
  state: GameState;
  mutate_ship: ShipChangerCallback;
}> = ({ state, mutate_ship }) => {
  const controls = {
    w: ShipAction.Move(Direction.Up),
    'w+a': ShipAction.Move(Direction.UpLeft),
    s: ShipAction.Move(Direction.Down),
    's+a': ShipAction.Move(Direction.DownLeft),
    a: ShipAction.Move(Direction.Left),
    's+d': ShipAction.Move(Direction.DownRight),
    d: ShipAction.Move(Direction.Right),
    'w+d': ShipAction.Move(Direction.UpRight),
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
