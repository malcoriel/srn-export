import React from 'react';
import { Window } from './ui/Window';
import './StatsWindow.scss';

export const StatsWindow: React.FC = () => {
  return (
    <Window
      height={600}
      width={800}
      line="complex"
      storeKey="statsWindow"
      toggleHotkey="tab"
      thickness={8}
    >
      <div className="stats-window">Stats window</div>
    </Window>
  );
};
