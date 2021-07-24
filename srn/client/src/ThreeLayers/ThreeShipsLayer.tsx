import React from 'react';
import { findContainer, findMineral, GameState, Ship } from '../world';
import { ThreeShip } from './ThreeShip';
import Vector from '../utils/Vector';
import { InteractorMap } from './InteractorMap';
import { NetStateIndexes } from '../NetState';
import { LongActionDock, LongActionUndock } from '../../../world/pkg';

export const ThreeShipsLayer: React.FC<{
  visMap: Record<string, boolean>;
  state: GameState;
  indexes: NetStateIndexes;
}> = ({ visMap, state, indexes }) => {
  if (!state) return null;
  const { ships } = state.locations[0];

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

        let dockingLongAction;
        let undockingLongAction;
        dockingLongAction = ship.long_actions.find(
          (a) => a.tag === 'Dock'
        ) as LongActionDock;
        undockingLongAction = ship.long_actions.find(
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
          />
        );
      })}
    </group>
  );
};
