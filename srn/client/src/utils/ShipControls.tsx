import React, { useEffect } from 'react';
import { ShipActionRust } from '../../../world/pkg';
import { ShipActionRustBuilder } from '../../../world/pkg/world.extra';

export const actionsActive: Record<string, ShipActionRust | undefined> = {
  Move: undefined,
  Dock: undefined,
  Navigate: undefined,
  DockNavigate: undefined,
  Tractor: undefined,
};

const keysActive: Record<string, boolean> = {};

const refreshActiveActions = () => {
  // TODO move action
  // actionsActive.Move = makeMoveAction(keysActive);
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

const singleUseActions = ['Navigate', 'DockNavigate', 'Dock', 'Tractor'];

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
