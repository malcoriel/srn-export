import React from 'react';
import NetState, {
  findMyPlayer,
  findMyShip,
  useNSForceChange,
} from '../NetState';
import { ActionBarAction, ActionsBar } from './ActionsBar';
import { Player, Ship } from '../world';
import { Ability } from '../../../world/pkg/world';
import { FaBullseye } from 'react-icons/all';

const mapShipAbility = (sa: Ability): ActionBarAction | null => {
  switch (sa.tag) {
    case 'Unknown':
      return null;
    case 'Shoot':
      return {
        action: () => console.log('shoot'),
        icon: <FaBullseye />,
      };
    case 'BlowUpOnLand':
      return null;
  }
};

const populateActionsByShip = (
  actions: ActionBarAction[],
  myShip: Ship | null | undefined
) => {
  if (!myShip) return;
  actions.push(
    ...(myShip.abilities
      .map(mapShipAbility)
      .filter((a) => !!a) as ActionBarAction[])
  );
};

const populateActionsByPlayer = (
  actions: ActionBarAction[],
  myPlayer: Player | null | undefined
) => {};

export const PlayerActionsBar: React.FC = () => {
  useNSForceChange('MoneyAndHp');
  const ns = NetState.get();
  if (!ns) {
    return null;
  }
  const myPlayer = findMyPlayer(ns.state);
  const myShip = findMyShip(ns.state);

  const actions: ActionBarAction[] = [];
  populateActionsByPlayer(actions, myPlayer);
  populateActionsByShip(actions, myShip);

  return (
    <ActionsBar
      className="control-panel-actions-bar"
      indexByNumbers
      actions={actions}
    />
  );
};
