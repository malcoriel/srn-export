import React from 'react';
import _ from 'lodash';
import { findMineral, GameState } from '../world';
import { ThreeShip } from './ThreeShip';
import { Ship } from '../world';
import Vector from '../utils/Vector';

export const ThreeShipsLayer: React.FC<{
  visMap: Record<string, boolean>;
  state: GameState;
}> = ({ visMap, state }) => {
  if (!state) return null;
  const { ships, planets } = state.locations[0];

  const planetsById = _.keyBy(planets, 'id');

  return (
    <group>
      {ships.map((s: Ship, i: number) => {
        let tractorTargetPosition;
        if (s.tractor_target) {
          const min = findMineral(state, s.tractor_target);
          if (min) {
            tractorTargetPosition = Vector.fromIVector(min);
          }
        }

        const shipPos = {
          x: s.x,
          y: s.y,
        };
        if (s.docked_at) {
          const dockPlanet = planetsById[s.docked_at];
          if (dockPlanet) {
            shipPos.x = dockPlanet.x;
            shipPos.y = dockPlanet.y;
          }
        }
        return (
          <ThreeShip
            visible={visMap[s.id]}
            tractorTargetPosition={tractorTargetPosition}
            key={s.id + i}
            position={Vector.fromIVector(s)}
            rotation={s.rotation}
            color={s.color}
          />
        );
      })}
    </group>
  );
};
