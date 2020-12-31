import React from 'react';

export const StartHudLayer: React.FC<{
  preferredName: string;
  onPreferredNameChange: (n: string) => void;
  onGo: () => void;
}> = ({ preferredName, onPreferredNameChange, onGo }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        height: '100%',
        width: '100%',
        backgroundColor: 'black',
        opacity: 0.5,
      }}
    >
      <div style={{ color: 'white' }}>
        <label htmlFor="name">Your name</label>
        <input
          type="text"
          style={{
            backgroundColor: 'black',
            color: 'white',
            opacity: 0.8,
            marginLeft: 10,
            marginRight: 10,
            display: 'inline-block',
          }}
          id="name"
          value={preferredName}
          onChange={(e) => onPreferredNameChange(e.target.value)}
        />
        <button onClick={onGo}>GO!</button>
      </div>
    </div>
  );
};
