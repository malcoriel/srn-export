import React, { useEffect } from 'react';
import { Action } from '../../../world/pkg';
import { ActionBuilder } from '../../../world/pkg/world.extra';
import NetState from '../NetState';

// keep those in sync
type SynchronousActionTags =
  | 'Gas'
  | 'TurnRight'
  | 'TurnLeft'
  | 'Reverse'
  | 'MoveAxis'
  | 'StopMoveAxis'
  | 'Navigate'
  | 'DockNavigate'
  | 'Tractor'
  | 'StopGas'
  | 'StopTurn';

const syncActionTags = new Set([
  'Gas',
  'TurnRight',
  'TurnLeft',
  'Reverse',
  'MoveAxis',
  'StopMoveAxis',
  'Navigate',
  'DockNavigate',
  'Tractor',
  'StopGas',
  'StopTurn',
]);

export const isSyncAction = (action: Action): boolean =>
  syncActionTags.has(action.tag);

const actionsActive: Record<SynchronousActionTags, Action | undefined> = {
  Gas: undefined,
  TurnRight: undefined,
  TurnLeft: undefined,
  Reverse: undefined,
  MoveAxis: undefined,
  Navigate: undefined,
  DockNavigate: undefined,
  Tractor: undefined,
  StopGas: undefined,
  StopTurn: undefined,
  StopMoveAxis: undefined,
};

export const getActiveSyncActions = () => {
  return Object.values(actionsActive).filter((a) => !!a) as Action[];
};

export const isSyncActionTypeActive = (type: SynchronousActionTags) => {
  return !!actionsActive[type];
};

export const executeSyncAction = (act: Action) => {
  const ns = NetState.get();
  if (!ns) {
    return;
  }

  if (syncActionTags.has(act.tag)) {
    // @ts-ignore - TS doesn't understand set-narrowing
    actionsActive[act.tag] = act;
  }
};

// Is primarily export for testing e.g. in storybook.
// actionsActive should be used for the real game.
export const keysActive: Record<string, boolean> = {};

const refreshActiveActions = () => {
  const ns = NetState.get();
  if (!ns) {
    return;
  }

  const myShipId = ns.indexes.myShip?.id;

  if (!myShipId) {
    return;
  }

  if (!keysActive.KeyW && keysActive.KeyS) {
    actionsActive.Reverse = ActionBuilder.ActionReverse({
      ship_id: myShipId,
    });
    actionsActive.Gas = undefined;
    actionsActive.StopGas = undefined;
  } else if (keysActive.KeyW && !keysActive.KeyS) {
    actionsActive.Gas = ActionBuilder.ActionGas({
      ship_id: myShipId,
    });
    actionsActive.Reverse = undefined;
    actionsActive.StopGas = undefined;
  } else if (actionsActive.Gas || actionsActive.Reverse) {
    actionsActive.Reverse = undefined;
    actionsActive.Gas = undefined;
    actionsActive.StopGas = ActionBuilder.ActionStopGas({
      ship_id: myShipId,
    });
  }

  if (!keysActive.KeyA && keysActive.KeyD) {
    // while it may be counterintuitive, it's not a mistake.
    // due to Y-inversion (in the visual part), right or counterclockwise direction is clockwise/left in proper game logic
    actionsActive.TurnRight = ActionBuilder.ActionTurnRight({
      ship_id: myShipId,
    });
    actionsActive.TurnLeft = undefined;
    actionsActive.StopTurn = undefined;
  } else if (keysActive.KeyA && !keysActive.KeyD) {
    actionsActive.TurnRight = undefined;
    actionsActive.TurnLeft = ActionBuilder.ActionTurnLeft({
      ship_id: myShipId,
    });
    actionsActive.StopTurn = undefined;
  } else if (actionsActive.TurnRight || actionsActive.TurnLeft) {
    actionsActive.TurnRight = undefined;
    actionsActive.TurnLeft = undefined;
    actionsActive.StopTurn = ActionBuilder.ActionStopTurn({
      ship_id: myShipId,
    });
  }

  if (keysActive.KeyX) {
    actionsActive.MoveAxis = ActionBuilder.ActionMoveAxis({
      ship_id: myShipId,
      brake: true,
    });
    actionsActive.StopMoveAxis = undefined;
  } else if (actionsActive.MoveAxis) {
    actionsActive.StopMoveAxis = ActionBuilder.ActionStopMoveAxis({
      ship_id: myShipId,
      brake: true,
    });
    actionsActive.MoveAxis = undefined;
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

const singleUseActions: SynchronousActionTags[] = [
  'Navigate',
  'DockNavigate',
  'Tractor',
  'StopGas',
  'StopTurn',
  'StopMoveAxis',
];

export const resetActiveSyncActions = () => {
  for (const key of singleUseActions) {
    actionsActive[key] = undefined;
  }
};

export const ShipControls: React.FC<{ onChange?: () => void }> = ({
  onChange,
}) => {
  useEffect(() => {
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyUpHandler);
    if (onChange) {
      document.addEventListener('keydown', onChange);
      document.addEventListener('keyup', onChange);
    }
    return () => {
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', keyUpHandler);
      if (onChange) {
        document.removeEventListener('keydown', onChange);
        document.removeEventListener('keyup', onChange);
      }
    };
  }, []);
  return null;
};
