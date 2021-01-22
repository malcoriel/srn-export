import { findMineral, GameState } from '../world';
import { ThreeShip } from './ThreeShip';
import React from 'react';
import _ from 'lodash';
import { Ship } from '../world';
import Vector from '../utils/Vector';

export const ThreeShipsLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { ships, players, planets } = state;

  const playersByShipId = _.keyBy(players, 'ship_id');
  const planetsById = _.keyBy(planets, 'id');

  return (
    <group>
      {ships.map((s: Ship, i: number) => {
        let tractorTargetPosition;
        if (s.tractor_target) {
          let min = findMineral(state, s.tractor_target);
          if (min) {
            tractorTargetPosition = Vector.fromIVector(min);
          }
        }

        let { name: player_name = 'player' } = playersByShipId[s.id] || {
          name: 'player',
        };
        let shipPos = {
          x: s.x,
          y: s.y,
        };
        if (s.docked_at) {
          let dockPlanet = planetsById[s.docked_at];
          if (dockPlanet) {
            shipPos.x = dockPlanet.x;
            shipPos.y = dockPlanet.y;
          }
        }
        return (
          <ThreeShip
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
