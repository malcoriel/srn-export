import React from 'react';
import './LongActionsDisplay.scss';
import NetState from '../NetState';
import _ from 'lodash';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { LongAction, LongActionPlayer } from '../../../world/pkg';
import { UnreachableCaseError } from 'ts-essentials';
import { findMyPlayer, findMyShip } from '../ClientStateIndexing';
import { useNSForceChange } from '../NetStateHooks';

const getActionName = (a: LongAction): string | undefined => {
  switch (a.tag) {
    case 'Dock':
      return 'Docking...';
    case 'Undock':
      return 'Undocking...';
    case 'Unknown':
      return undefined;
    case 'TransSystemJump':
      return 'Jumping...';
    case 'Shoot':
      return undefined;
    default:
      throw new UnreachableCaseError(a);
  }
};

const getActionNamePlayer = (a: LongActionPlayer): string | undefined => {
  switch (a.tag) {
    case 'Unknown':
      return undefined;
    case 'Respawn':
      return 'Respawning...';
    default:
      throw new UnreachableCaseError(a);
  }
};

export const LongActionsDisplay = () => {
  const ns = NetState.get();
  if (!ns) return null;
  useNSForceChange('LongActionsDisplay', false, (oldState, newState) => {
    const myPlayerOld = findMyPlayer(oldState);
    const myShipOld = findMyShip(oldState);
    const myShipNew = findMyShip(newState);
    const myPlayerNew = findMyPlayer(newState);
    if (!myPlayerOld || !myPlayerNew) return false;
    return (
      !_.isEqual(myPlayerOld.long_actions, myPlayerNew.long_actions) ||
      !!(
        myShipOld &&
        myShipNew &&
        !_.isEqual(myShipOld.long_actions, myShipNew.long_actions)
      )
    );
  });
  const myPlayer = findMyPlayer(ns.state);
  if (!myPlayer) {
    return null;
  }
  const { long_actions } = myPlayer;
  const myShip = ns.indexes.myShip;
  console.log('render', myShip?.long_actions);
  return (
    <div className="long-actions-display">
      <div className="container">
        {long_actions.map((a) => {
          const name = getActionNamePlayer(a);
          if (a.tag === 'Unknown' || !name) {
            return null;
          }
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
        {myShip &&
          myShip.long_actions.map((a) => {
            const name = getActionName(a);
            if (a.tag === 'Unknown' || !name) {
              return null;
            }
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
