import React from 'react';
import NetState from '../NetState';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { PanelPosition, PanelWithHideButton } from './PanelWithHideButton';

export const InGameLeaderBoardPanel = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { leaderboard, milliseconds_remaining, my_id } = ns.state;
  if (!leaderboard) return null;
  return (
    <PanelWithHideButton
      defaultValue={false}
      hotkey={'shift+l'}
      position={PanelPosition.BottomLeft}
      description="show leaderboard"
    >
      <div className="leaderboard-panel">
        <div className="scores">
          <div className="header">Scores</div>
          {leaderboard.rating.map(([p, s], i) => {
            const current = p.id == my_id ? 'my-score' : '';
            return (
              <div className={`line ${current}`} key={p.id}>
                {i + 1}. {p.name} - {s} cr.
              </div>
            );
          })}
        </div>
        <div className="countdown">
          Time left {Math.floor(milliseconds_remaining / 1000)}
        </div>
      </div>
    </PanelWithHideButton>
  );
};
