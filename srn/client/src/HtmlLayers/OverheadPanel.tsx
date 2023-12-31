import { StyledRect } from './ui/StyledRect';
import './OverheadPanel.scss';
import React from 'react';
import NetState from '../NetState';
import { isStateTutorial } from '../world';
import { useNSForceChange } from '../NetStateHooks';

function getSeconds(milliseconds_remaining: number) {
  return Math.floor(milliseconds_remaining / 1000);
}

export const OverheadPanel = () => {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('OverheadPanel', false, (prevState, nextState) => {
    return (
      getSeconds(prevState.milliseconds_remaining) !==
      getSeconds(nextState.milliseconds_remaining)
    );
  });

  const { milliseconds_remaining } = ns.state;

  if (milliseconds_remaining <= 0) return null;

  let seconds = getSeconds(milliseconds_remaining);
  const minutes = Math.floor(seconds / 60) || '';
  seconds %= 60;
  const formatted = `${minutes}${minutes ? ':' : ''}${String(seconds).padStart(
    2,
    '0'
  )}`;

  if (isStateTutorial(ns.state)) return null;

  return (
    <div className="overhead-panel-container">
      <StyledRect
        height={44}
        width={100}
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
};
