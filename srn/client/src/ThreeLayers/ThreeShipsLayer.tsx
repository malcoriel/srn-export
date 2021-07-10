import React from 'react';
import { findContainer, findMineral, GameState, Ship } from '../world';
import { ThreeShip } from './ThreeShip';
import Vector from '../utils/Vector';
import { InteractorMap } from './InteractorMap';
import { NetStateIndexes } from '../NetState';
import { LongActionDock } from '../../../world/pkg';

export const ThreeShipsLayer: React.FC<{
  visMap: Record<string, boolean>;
  state: GameState;
  indexes: NetStateIndexes;
}> = ({ visMap, state, indexes }) => {
  if (!state) return null;
  const { ships } = state.locations[0];

  return (
    <group>
      {ships.map((s: Ship, i: number) => {
        if (s.docked_at) return null;
        let tractorTargetPosition;
        if (s.tractor_target) {
          const min = findMineral(state, s.tractor_target);
          const cont = findContainer(state, s.tractor_target);
          if (min) {
            tractorTargetPosition = Vector.fromIVector(min);
          } else if (cont) {
            tractorTargetPosition = Vector.fromIVector(cont.position);
          }
        }

        const player = indexes.playersByShipId.get(s.id);

        let dockingLongAction;
        if (player) {
          dockingLongAction = player.long_actions.find(
            (a) => a.tag === 'Dock'
          ) as LongActionDock;
        }

        let opacity = dockingLongAction
          ? 1 - dockingLongAction.percentage / 100
          : 1.0;
        if (s.docked_at) {
          opacity = 0.0;
        }
        return (
          <ThreeShip
            gid={s.id}
            radius={s.radius}
            visible={visMap[s.id]}
            tractorTargetPosition={tractorTargetPosition}
            key={s.id + i}
            position={Vector.fromIVector(s)}
            rotation={s.rotation}
            color={s.color}
            opacity={opacity}
            interactor={InteractorMap.ship(s)}
          />
        );
      })}
    </group>
  );
};
