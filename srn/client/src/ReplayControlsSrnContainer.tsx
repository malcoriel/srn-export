import { useNSForceChange } from './NetState';
import { ReplayPlayerControls } from './HtmlLayers/ui/ReplayPlayerControls';
import React from 'react';

export const ReplayControlsSrnContainer = () => {
  const ns = useNSForceChange(
    'ReplayControlsContainer',
    false,
    (_a, _b) => true
  );
  if (!ns) {
    return null;
  }
  return (
    <ReplayPlayerControls
      bottom
      maxTimeMs={ns.replay?.max_time_ms || 0}
      onChange={ns.rewindReplayToMs}
      value={ns.replay?.current_millis || 0}
      marks={ns.replay?.marks.map((m: number) => m / 1000)}
      onPause={ns.pauseReplay}
      onPlay={ns.resumeReplay}
      playing={ns.playingReplay}
    />
  );
};
