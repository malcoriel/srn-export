import { StyledRect } from './ui/StyledRect';
import './OverheadPanel.scss';
import React from 'react';
import NetState, { useNSForceChange } from '../NetState';

function getSeconds(milliseconds_remaining: number) {
  return Math.floor(milliseconds_remaining / 1000);
}

export function OverheadPanel() {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('OverheadPanel', false, (prevState, nextState) => {
    let check = getSeconds(prevState.milliseconds_remaining) !== getSeconds(nextState.milliseconds_remaining);
    return check;
  });

  const { milliseconds_remaining } = ns.state;

  if (milliseconds_remaining <= 0) return null;

  let seconds = getSeconds(milliseconds_remaining);
  let minutes = Math.floor(seconds / 60) || '';
  seconds = seconds % 60;
  const formatted = `${minutes}${minutes ? ':' : ''}${String(seconds).padStart(
    2,
    '0'
  )}`;

  return (
    <div className="overhead-panel-container">
      <StyledRect
        height={50}
        width={80}
        line="thin"
        halfThick
        noTop
        className="overhead-panel"
        contentClassName="overhead-panel-content"
        thickness={8}
      >
        <span className="time">{formatted}</span>
      </StyledRect>
    </div>
  );
}
