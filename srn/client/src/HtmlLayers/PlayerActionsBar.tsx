import React from 'react';
import NetState from '../NetState';
import { ActionBarAction, ActionsBar } from './ActionsBar';
import { ObjectSpecifier, Player, Ship } from '../world';
// eslint-disable-next-line import/named
import { Ability } from '../../../world/pkg/world';
import { FaBullseye } from 'react-icons/fa';
import { UnreachableCaseError } from 'ts-essentials';
import { useActiveInteractors } from '../store';
import {
  LongActionStartBuilder,
  ObjectSpecifierBuilder,
} from '../../../world/pkg/world.extra';
import { findMyPlayer, findMyShip } from '../ClientStateIndexing';
import { useNSForceChange } from '../NetStateHooks';
import { BsGearFill } from 'react-icons/bs';

const mapShipAbility = (interactorIds: InteractorIds) => (
  ability: Ability,
  abilityIndex: number
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
              target: ObjectSpecifierBuilder.ObjectSpecifierShip({
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
    case 'ToggleMovement':
      return {
        action: () => {
          const ns = NetState.get();
          if (!ns) {
            return;
          }
          ns.startLongAction(
            LongActionStartBuilder.LongActionStartUseAbility({
              ability_idx: abilityIndex,
              params: null,
            })
          );
        },
        cooldownNormalized: 0,
        icon: <BsGearFill />,
      };
    case 'Launch':
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
      .map((ab, idx) => mapShipAbility(interactorIds)(ab, idx))
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
  if (!ns) {
    return null;
  }

  const { neutralId, hostileId } = useActiveInteractors();
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
