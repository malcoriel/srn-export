import React from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { ActionBarAction, ActionsBar } from './ActionsBar';
import { Player, Ship } from '../world';
// eslint-disable-next-line import/named
import { Ability } from '../../../world/pkg/world';
import { FaBullseye } from 'react-icons/all';
import { UnreachableCaseError } from 'ts-essentials';
import { useActiveInteractors } from '../store';
import {
  LongActionStartBuilder,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import { findMyPlayer, findMyShip } from '../ClientStateIndexing';

const mapShipAbility = (interactorIds: InteractorIds) => (
  ability: Ability
): ActionBarAction | null => {
  switch (ability.tag) {
    case 'Unknown':
      return null;
    case 'Shoot':
      return {
        action: () => {
          const { hostileId } = interactorIds;
          const ns = NetState.get();
          if (!ns || !hostileId) {
            return;
          }
          ns.startLongAction(
            LongActionStartBuilder.LongActionStartShoot({
              target: ShootTargetBuilder.ShootTargetShip({
                id: hostileId,
              }),
              turret_id: ability.turret_id,
            })
          );
        },
        cooldownNormalized: ability.cooldown_normalized,
        icon: <FaBullseye />,
      };
    case 'BlowUpOnLand':
      return null;
    case 'ShootAll':
      return null;
    default:
      throw new UnreachableCaseError(ability);
  }
};

const populateActionsByShip = (
  actions: ActionBarAction[],
  myShip: Ship | null | undefined,
  interactorIds: InteractorIds
) => {
  if (!myShip) return;
  actions.push(
    ...(myShip.abilities
      .map(mapShipAbility(interactorIds))
      .filter((a) => !!a) as ActionBarAction[])
  );
};

const populateActionsByPlayer = (
  _actions: ActionBarAction[],
  _myPlayer: Player | null | undefined,
  _interactorIds: InteractorIds
) => {};

type InteractorIds = {
  neutralId: string | undefined;
  hostileId: string | undefined;
};
export const PlayerActionsBar: React.FC = () => {
  const ns = useNSForceChange('PlayerActionsBar', false, (prev, next) => {
    // const myPlayerPrev = findMyPlayer(prev);
    const myShipPrev = findMyShip(prev);
    // const myPlayerNext = findMyPlayer(next);
    const myShipNext = findMyShip(next);
    return (
      JSON.stringify(myShipPrev?.abilities) !==
      JSON.stringify(myShipNext?.abilities)
    );
  });
  const { neutralId, hostileId } = useActiveInteractors();
  if (!ns) {
    return null;
  }
  const interactorIds: InteractorIds = {
    neutralId,
    hostileId,
  };
  const myPlayer = findMyPlayer(ns.state);
  const myShip = findMyShip(ns.state);

  const actions: ActionBarAction[] = [];
  populateActionsByPlayer(actions, myPlayer, interactorIds);
  populateActionsByShip(actions, myShip, interactorIds);

  return (
    <ActionsBar
      className="control-panel-actions-bar"
      indexByNumbers
      actions={actions}
    />
  );
};
