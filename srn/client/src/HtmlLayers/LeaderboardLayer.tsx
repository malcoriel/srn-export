import React from 'react';
import { height_px, width_px } from '../world';
import NetState from '../NetState';

export const LeaderboardLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { leaderboard, milliseconds_remaining } = ns.state;
  if (!leaderboard) {
    return null;
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        color: 'white',
        backgroundColor: 'gray',
        width: width_px,
        height: height_px,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div>
        <div>Winner: {leaderboard.winner}</div>
        <div>
          <span>Scores:</span>
          {leaderboard.rating.map(([p, s]) => (
            <div key={p.id}>
              {p.name} - {s}
            </div>
          ))}
        </div>
        <div>New game in {Math.floor(milliseconds_remaining / 1000)}</div>
      </div>
    </div>
  );
};
