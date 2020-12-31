import React from 'react';
import { height_px, Leaderboard, width_px } from '../world';

export const LeaderboardLayer: React.FC<{
  leaderboard: Leaderboard;
  milliseconds_remaining: number;
}> = ({ leaderboard, milliseconds_remaining }) => (
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
