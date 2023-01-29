import React from 'react';
import { Window } from './ui/Window';
import './StatsWindow.scss';
import { formatNumber, Stat, statsHeap, StatsPanel } from './Perf';
import { useNSForceChange } from '../NetStateHooks';
import { getSrnState, WindowState } from '../store';
import { api } from '../utils/api';

export const StatsWindow: React.FC = () => {
  useNSForceChange(
    'StatsWindow',
    false,
    () => getSrnState().statsWindow === WindowState.Shown,
    1000
  );
  const perf = api.usePerf();

  return (
    <Window
      height={600}
      width={800}
      line="complex"
      storeKey="statsWindow"
      toggleHotkey="tab"
      thickness={8}
      contentClassName="stats-window"
    >
      <div>
        <StatsPanel />
      </div>
      <div>
        <div className="stats">
          <div className="header">Server stats:</div>
          <div className="row">
            <span className="name">Frame count</span>
            <span className="value">{formatNumber(perf.frame_count)}</span>
          </div>
          <div className="row">
            <span className="name">Over budget %</span>
            <span className="value">{formatNumber(perf.over_budget_pct)}%</span>
          </div>
          <div className="row">
            <span className="name">Shortcut %</span>
            <span className="value">{formatNumber(perf.shortcut_pct)}%</span>
          </div>
        </div>
      </div>
    </Window>
  );
};
