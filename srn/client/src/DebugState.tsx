import React from 'react';
import { GameState } from './common';

export const DebugState: React.FC<{ state: GameState }> = ({ state }) => {
  return (
    <div
      style={{
        position: 'absolute',
        overflowX: 'hidden',
        overflowY: 'auto',
        left: 5,
        bottom: 5,
        width: 300,
        height: 300,
        opacity: 0.5,
        border: 'solid gray 0.5px',
      }}
    >
      {JSON.stringify(state, null, 2)}
    </div>
  );
};
