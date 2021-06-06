import React from 'react';
import './LongActionsDisplay.scss';
import NetState, { findMyPlayer, useNSForceChange } from '../NetState';
import _ from 'lodash';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

export const LongActionsDisplay = () => {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('LongActionsDisplay', false, (oldState, newState) => {
    const myPlayerOld = findMyPlayer(oldState);
    const myPlayerNew = findMyPlayer(newState);
    if (!myPlayerOld || !myPlayerNew) return false;
    return !_.isEqual(myPlayerOld.long_actions, myPlayerNew.long_actions);
  });
  const myPlayer = findMyPlayer(ns.state);
  if (!myPlayer) {
    return null;
  }
  const { long_actions } = myPlayer;
  return (
    <div className="long-actions-display">
      <div className="container">
        {long_actions.map((a) => {
          if (a.tag === 'Unknown' || a.tag === 'Shoot') {
            return null;
          }
          return (
            <div key={a.id} className="action">
              <CircularProgressbar
                value={a.percentage + 2}
                text={`${(Math.floor(a.micro_left / 1000 / 100) / 10).toFixed(
                  1
                )}s`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
