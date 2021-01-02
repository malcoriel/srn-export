import React, { useState } from 'react';
import ReactJson from 'react-json-view';
import { useHotkeys } from 'react-hotkeys-hook';
import NetState from '../NetState';
import { useToggleHotkey } from '../utils/useToggleHotkey';

export const DebugStateLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state } = ns;
  const shown = useToggleHotkey('shift+d', false);
  if (!shown) return null;

  return shown ? (
    <div
      style={{
        position: 'absolute',
        overflowX: 'hidden',
        overflowY: 'auto',
        bottom: 0,
        right: 0,
        width: 320,
        height: 500,
        opacity: 1,
        color: 'white',
        backgroundColor: '#555',
        zIndex: 0,
        border: 'solid blue 1px',
      }}
    >
      <ReactJson src={state} />
    </div>
  ) : null;
};
