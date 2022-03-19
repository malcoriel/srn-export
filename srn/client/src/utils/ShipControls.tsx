import React, { useEffect } from 'react';
import { Action } from '../../../world/pkg';
import { ActionBuilder } from '../../../world/pkg/world.extra';
import NetState from '../NetState';

export const actionsActive: Record<string, Action | undefined> = {
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
  const ns = NetState.get();
  if (!ns) {
    return null;
  }

  const myId = ns.state.my_id;

  if (!keysActive.KeyW && keysActive.KeyS) {
    actionsActive.Reverse = ActionBuilder.ActionReverse({
      player_id: myId,
    });
    actionsActive.Gas = undefined;
    actionsActive.StopGas = undefined;
  } else if (keysActive.KeyW && !keysActive.KeyS) {
    actionsActive.Gas = ActionBuilder.ActionGas({
      player_id: myId,
    });
    actionsActive.Reverse = undefined;
    actionsActive.StopGas = undefined;
  } else if (actionsActive.Gas || actionsActive.Reverse) {
    actionsActive.Reverse = undefined;
    actionsActive.Gas = undefined;
    actionsActive.StopGas = ActionBuilder.ActionStopGas({
      player_id: myId,
    });
  }

  if (!keysActive.KeyA && keysActive.KeyD) {
    // while it maybe counterituitive, it's not a mistake.
    // due to Y-inversion, right or counterclockwise direction is clockwise/left in proper game logic
    actionsActive.TurnLeft = ActionBuilder.ActionTurnLeft({
      player_id: myId,
    });
    actionsActive.TurnRight = undefined;
    actionsActive.StopTurn = undefined;
  } else if (keysActive.KeyA && !keysActive.KeyD) {
    actionsActive.TurnLeft = undefined;
    actionsActive.TurnRight = ActionBuilder.ActionTurnRight({
      player_id: myId,
    });
    actionsActive.StopTurn = undefined;
  } else if (actionsActive.TurnRight || actionsActive.TurnLeft) {
    actionsActive.TurnRight = undefined;
    actionsActive.TurnLeft = undefined;
    actionsActive.StopTurn = ActionBuilder.ActionStopTurn({
      player_id: myId,
    });
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
