import React from 'react';
import { GameState } from './world';
import ReactJson from 'react-json-view';

export const DebugStateLayer: React.FC<{ state: GameState }> = ({ state }) => {
  return (
    <div
      style={{
        position: 'absolute',
        overflowX: 'hidden',
        overflowY: 'auto',
        right: 5,
        bottom: 5,
        width: 320,
        height: 500,
        opacity: 0.9,
        backgroundColor: 'white',
        zIndex: 0,
        border: 'solid gray 0.5px',
      }}
    >
      <ReactJson src={state} />
    </div>
  );
};
