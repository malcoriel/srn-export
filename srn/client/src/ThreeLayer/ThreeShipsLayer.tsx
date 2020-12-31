import { GameState } from '../world';
import { ThreeShip } from './ThreeShip';
import React from 'react';
import _ from 'lodash';
import { Ship } from '../world';
import { posToThreePos } from './ThreeLayer';

export const ThreeShipsLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { ships, players, planets } = state;

  const playersByShipId = _.keyBy(players, 'ship_id');
  const planetsById = _.keyBy(planets, 'id');

  return (
    <group>
      {ships.map((s: Ship, i: number) => {
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
        const scale = _.times(3, () => s.radius) as [number, number, number];
        return (
          <ThreeShip
            key={s.id + i}
            position={posToThreePos(s.x, s.y)}
            name={player_name}
            scale={scale}
            color={s.color}
          />
        );
      })}
    </group>
  );
};
