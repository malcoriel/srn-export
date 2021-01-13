import React from 'react';
import { size } from '../world';
import NetState, { useNSForceChange } from '../NetState';
import { useToggleHotkey } from '../utils/useToggleHotkey';

export const LeaderboardLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('LeaderboardLayer');
  const { leaderboard, milliseconds_remaining, paused } = ns.state;
  if (!leaderboard || !paused) {
    return null;
  }
  return (
    <div className="panel central-panel  final-leaderboard">
      <div>
        <div className="winner">Winner: {leaderboard.winner}</div>
        <div className="scores">Scores:</div>
        {leaderboard.rating.map(([p, s], i) => (
          <div className="line" key={p.id}>
            {i + 1}. {p.name} - {s}
          </div>
        ))}
        <div className="countdown">
          New game in {Math.floor(milliseconds_remaining / 1000)}
        </div>
      </div>
    </div>
  );
};
