import React, { useEffect } from 'react';
import { ShipActionRust } from '../../../world/pkg';
import { ShipActionRustBuilder } from '../../../world/pkg/world.extra';

export const actionsActive: Record<string, ShipActionRust | undefined> = {
  Gas: undefined,
  TurnRight: undefined,
  TurnLeft: undefined,
  Reverse: undefined,
  Move: undefined,
  Dock: undefined,
  Navigate: undefined,
  DockNavigate: undefined,
  Tractor: undefined,
  StopGas: undefined,
  StopTurn: undefined,
};

const keysActive: Record<string, boolean> = {};

const refreshActiveActions = () => {
  if (!keysActive.KeyW && keysActive.KeyS) {
    actionsActive.Reverse = ShipActionRustBuilder.ShipActionRustReverse();
    actionsActive.Gas = undefined;
    actionsActive.StopGas = undefined;
  } else if (keysActive.KeyW && !keysActive.KeyS) {
    actionsActive.Gas = ShipActionRustBuilder.ShipActionRustGas();
    actionsActive.Reverse = undefined;
    actionsActive.StopGas = undefined;
  } else {
    actionsActive.Reverse = undefined;
    actionsActive.Gas = undefined;
    actionsActive.StopGas = ShipActionRustBuilder.ShipActionRustStopGas();
  }

  actionsActive.Dock = keysActive.Space
    ? ShipActionRustBuilder.ShipActionRustDock()
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

const singleUseActions = [
  'Navigate',
  'DockNavigate',
  'Dock',
  'Tractor',
  'StopGas',
  'StopTurn',
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
