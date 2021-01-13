import React from 'react';
import NetState, { findMyPlayer, useNSForceChange } from '../NetState';
import { Window } from './ui/Window';
import './LeaderboardWindow.scss';

export const LeaderboardWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('LeaderboardWindow');
  const { leaderboard, milliseconds_remaining, paused, my_id } = ns.state;
  if (!leaderboard) {
    return null;
  }

  const place = leaderboard.rating.findIndex(([p]) => p.id == my_id) + 1;
  const totalPlaces = leaderboard.rating.length;

  return (
    <Window
      width={250}
      height={400}
      thickness={8}
      line="thick"
      storeKey="leaderboardWindow"
      className="leaderboard-window"
      contentClassName="leaderboard-window-content"
      minimized={
        place && (
          <div className="leaderboard-window-minimized">
            Your place: {place} of {totalPlaces}
          </div>
        )
      }
    >
      {paused && <div className="winner">Winner: {leaderboard.winner}</div>}
      <div className="header">Leaderboard:</div>
      {leaderboard.rating.map(([p, s], i) => (
        <div className="line" key={p.id}>
          {i + 1}. {p.name} - {s}
        </div>
      ))}
      <div className="countdown">
        New game in {Math.floor(milliseconds_remaining / 1000)}
      </div>
    </Window>
  );
};
