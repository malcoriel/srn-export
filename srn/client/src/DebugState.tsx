import useSWR from 'swr';
import React from 'react';

export const DebugState = () => {
  const { data: state } = useSWR('http://localhost:8000/api/state');
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
