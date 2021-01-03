import React from 'react';
import { GameState, Planet, QuestState } from '../world';
import NetState, { findMyPlayer } from '../NetState';

export const findPlanet = (
  state: GameState,
  id: string
): Planet | undefined => {
  return state.planets.find((p) => p.id === id);
};

export const GameHTMLHudLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { connecting, state, ping, maxPing } = ns;
  return (
    <div
      style={{
        color: 'white',
        position: 'absolute',
        top: 0,
        left: 0,
        padding: 10,
        height: '100%',
        width: 'calc(100%-10px)',
        pointerEvents: 'none',
      }}
    >
      {connecting && <span>Connecting...&nbsp;</span>}
      {!connecting && (
        <span>
          Ping: {ping}
          {maxPing && <span>&nbsp;({maxPing} max)</span>}.&nbsp;
        </span>
      )}
      {state.milliseconds_remaining > 0 ? (
        <span>
          <span>
            Time before the game ends:{' '}
            {Math.floor(state.milliseconds_remaining / 1000)} seconds. &nbsp;
          </span>
        </span>
      ) : null}
    </div>
  );
};
