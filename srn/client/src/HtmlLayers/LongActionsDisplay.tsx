import React from 'react';
import './LongActionsDisplay.scss';
import NetState, { findMyPlayer, useNSForceChange } from '../NetState';
import _ from 'lodash';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { LongAction } from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';

const getActionName = (a: LongAction): string | undefined => {
  switch (a.tag) {
    case 'Dock':
      return 'Docking...';
    case 'Undock':
      return 'Undocking..';
    case 'Unknown':
      return undefined;
    case 'TransSystemJump':
      return 'Jumping...';
    case 'Respawn':
      return 'Respawning...';
    case 'Shoot':
      return undefined;
    default:
      throw new UnreachableCaseError(a);
  }
};

export const isDisplayableLongAction = (a: LongAction): boolean => {
  switch (a.tag) {
    case 'Unknown':
      return false;
    case 'TransSystemJump':
      return true;
    case 'Respawn':
      return true;
    case 'Shoot':
      return false;
    case 'Dock':
      return true;
    case 'Undock':
      return true;
    default:
      throw new UnreachableCaseError(a);
  }
};

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
          if (a.tag === 'Unknown' || !isDisplayableLongAction(a)) {
            return null;
          }
          const name = getActionName(a);
          return (
            <div key={a.id} className="action">
              {name && <div className="name">{name}</div>}
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
