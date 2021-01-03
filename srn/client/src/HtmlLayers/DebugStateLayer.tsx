import React, { useState } from 'react';
import ReactJson from 'react-json-view';
import { useHotkeys } from 'react-hotkeys-hook';
import NetState from '../NetState';
import { useToggleHotkey } from '../utils/useToggleHotkey';

export const DebugStateLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state } = ns;
  const shown = useToggleHotkey(
    'ctrl+shift+d',
    false,
    'show state (huge FPS drop!)'
  );
  if (!shown) return null;

  return shown ? (
    <div className="panel aux-panel debug-state">
      <ReactJson src={state} />
    </div>
  ) : null;
};
