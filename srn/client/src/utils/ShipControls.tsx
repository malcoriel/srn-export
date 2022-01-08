import React, { useEffect } from 'react';
import { PlayerActionRust } from '../../../world/pkg';
import { PlayerActionRustBuilder } from '../../../world/pkg/world.extra';

export const actionsActive: Record<string, PlayerActionRust | undefined> = {
  Gas: undefined,
  TurnRight: undefined,
  TurnLeft: undefined,
  Reverse: undefined,
  Move: undefined,
  Navigate: undefined,
  DockNavigate: undefined,
  Tractor: undefined,
  StopGas: undefined,
  StopTurn: undefined,
};

const keysActive: Record<string, boolean> = {};

const refreshActiveActions = () => {
  if (!keysActive.KeyW && keysActive.KeyS) {
    actionsActive.Reverse = PlayerActionRustBuilder.PlayerActionRustReverse();
    actionsActive.Gas = undefined;
    actionsActive.StopGas = undefined;
  } else if (keysActive.KeyW && !keysActive.KeyS) {
    actionsActive.Gas = PlayerActionRustBuilder.PlayerActionRustGas();
    actionsActive.Reverse = undefined;
    actionsActive.StopGas = undefined;
  } else if (actionsActive.Gas || actionsActive.Reverse) {
    actionsActive.Reverse = undefined;
    actionsActive.Gas = undefined;
    actionsActive.StopGas = PlayerActionRustBuilder.PlayerActionRustStopGas();
  }

  if (!keysActive.KeyA && keysActive.KeyD) {
    actionsActive.TurnRight = PlayerActionRustBuilder.PlayerActionRustTurnRight();
    actionsActive.TurnLeft = undefined;
    actionsActive.StopTurn = undefined;
  } else if (keysActive.KeyA && !keysActive.KeyD) {
    actionsActive.TurnRight = undefined;
    actionsActive.TurnLeft = PlayerActionRustBuilder.PlayerActionRustTurnLeft();
    actionsActive.StopTurn = undefined;
  } else if (actionsActive.TurnRight || actionsActive.TurnLeft) {
    actionsActive.TurnRight = undefined;
    actionsActive.TurnLeft = undefined;
    actionsActive.StopTurn = PlayerActionRustBuilder.PlayerActionRustStopTurn();
  }
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
