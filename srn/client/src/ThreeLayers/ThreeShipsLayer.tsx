import React from 'react';
import { findContainer, findMineral, GameState, Ship } from '../world';
import { ThreeShip } from './ThreeShip';
import Vector from '../utils/Vector';
import { InteractorMap } from './InteractorMap';
import { NetStateIndexes } from '../NetState';
import {
  LongAction,
  LongActionDock,
  LongActionUndock,
} from '../../../world/pkg';
import { ThreeShipWreck } from './ThreeShipWreck';
import _ from 'lodash';

// Right now, there's no server-side support for actual separate shooting
// So this mapping is for visual effect only
const mapLongActions = (long_actions: LongAction[]) => {
  return long_actions
    .map((la) => {
      if (la.tag !== 'Shoot') {
        return null;
      }
      const la1: any = _.clone(la);
      la1.turretId = '1';
      const la2: any = _.clone(la);
      la2.turretId = '2';
      return [la1, la2];
    })
    .filter((la) => !!la)
    .flat() as LongAction[];
};

const STATIC_TURRETS = [{ id: '1' }, { id: '2' }];

export const ThreeShipsLayer: React.FC<{
  visMap: Record<string, boolean>;
  state: GameState;
  indexes: NetStateIndexes;
}> = ({ visMap, state }) => {
  if (!state) return null;
  const { ships, wrecks } = state.locations[0];

  return (
    <group>
      {ships.map((ship: Ship, i: number) => {
        if (ship.docked_at) return null;
        let tractorTargetPosition;
        if (ship.tractor_target) {
          const min = findMineral(state, ship.tractor_target);
          const cont = findContainer(state, ship.tractor_target);
          if (min) {
            tractorTargetPosition = Vector.fromIVector(min);
          } else if (cont) {
            tractorTargetPosition = Vector.fromIVector(cont.position);
          }
        }

        const dockingLongAction = ship.long_actions.find(
          (a) => a.tag === 'Dock'
        ) as LongActionDock;
        const undockingLongAction = ship.long_actions.find(
          (a) => a.tag === 'Undock'
        ) as LongActionUndock;
        let opacity: number;
        if (dockingLongAction) {
          opacity = 1 - dockingLongAction.percentage / 100;
        } else if (undockingLongAction) {
          opacity = undockingLongAction.percentage / 100;
        } else {
          opacity = 1.0;
        }
        return (
          <ThreeShip
            gid={ship.id}
            radius={ship.radius * (opacity / 2 + 0.5)}
            visible={visMap[ship.id]}
            tractorTargetPosition={tractorTargetPosition}
            key={ship.id + i}
            position={Vector.fromIVector(ship)}
            rotation={ship.rotation}
            color={ship.color}
            opacity={opacity}
            interactor={InteractorMap.ship(ship)}
            hpNormalized={ship.health.current / ship.health.max}
            longActions={mapLongActions(ship.long_actions)}
            turrets={STATIC_TURRETS}
          />
        );
      })}
      {wrecks.map((w) => {
        return (
          <ThreeShipWreck
            key={w.id}
            color={w.color}
            gid={w.id}
            opacity={1.0}
            position={Vector.fromIVector(w.position)}
            radius={w.radius}
            rotation={w.rotation}
          />
        );
      })}
    </group>
  );
};
