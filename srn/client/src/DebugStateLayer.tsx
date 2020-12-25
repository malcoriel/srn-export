import React from 'react';
import { GameState } from './common';
import ReactJson from 'react-json-view';

export const DebugStateLayer: React.FC<{ state: GameState }> = ({ state }) => {
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
        opacity: 0.9,
        backgroundColor: 'white',
        zIndex: 1,
        border: 'solid gray 0.5px',
      }}
    >
      <ReactJson src={state} />
    </div>
  );
};
