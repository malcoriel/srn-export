import React, { useEffect } from 'react';
import { Direction, ShipAction, ShipActionType } from '../world';

export type ShipChangerCallback = (sa: ShipAction) => void;

const makeMoveAction = (
  activeKeys: Record<string, boolean>
): ShipAction | undefined => {
  const up = activeKeys.KeyW;
  const left = activeKeys.KeyA;
  const down = activeKeys.KeyS;
  const right = activeKeys.KeyD;

  let p = '';
  p += up ? 'W' : '_';
  p += left ? 'A' : '_';
  p += down ? 'S' : '_';
  p += right ? 'D' : '_';

  let nextDir;
  if (p === 'W___') nextDir = Direction.Up;
  else if (p === '_A__') nextDir = Direction.Left;
  else if (p === '__S_') nextDir = Direction.Down;
  else if (p === '___D') nextDir = Direction.Right;
  else if (p === 'WA__') nextDir = Direction.UpLeft;
  else if (p === 'W__D') nextDir = Direction.UpRight;
  else if (p === '_AS_') nextDir = Direction.DownLeft;
  else if (p === '__SD') nextDir = Direction.DownRight;
  else nextDir = undefined;

  return nextDir ? ShipAction.Move(nextDir) : undefined;
};

const refreshActiveActions = () => {
  actionsActive[ShipActionType.Move] = makeMoveAction(keysActive);
  actionsActive[ShipActionType.Dock] = keysActive.Space
    ? ShipAction.Dock()
    : undefined;
};

const keydownHandler = (keyDownEvent: KeyboardEvent) => {
  keysActive[keyDownEvent.code] = true;
  refreshActiveActions();
};

const keyUpHandler = (keyDownEvent: KeyboardEvent) => {
  keysActive[keyDownEvent.code] = false;
  refreshActiveActions();
};

const keysActive: Record<string, boolean> = {};

export const actionsActive: Record<string, ShipAction | undefined> = {
  [ShipActionType.Move]: undefined,
  [ShipActionType.Dock]: undefined,
  [ShipActionType.Navigate]: undefined,
  [ShipActionType.DockNavigate]: undefined,
  [ShipActionType.Tractor]: undefined,
};

const singleUseActions = [
  ShipActionType.Navigate,
  ShipActionType.DockNavigate,
  ShipActionType.Dock,
  ShipActionType.Tractor,
];

export const resetActions = () => {
  for (const key of singleUseActions) {
    actionsActive[key] = undefined;
  }
};

export const ShipControls: React.FC = () => {
  useEffect(() => {
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyUpHandler);
    return () => {
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', keyUpHandler);
    };
  }, []);
  return null;
};
