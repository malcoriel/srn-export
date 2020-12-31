import React from 'react';
import { GameState, ShipAction, ShipActionType } from '../world';
import _ from 'lodash';
import { ThreeStar } from './ThreeStar';
import { posToThreePos } from './ThreeLayer';
import { ThreePlanetShape } from './ThreePlanetShape';
import { actionsActive } from '../utils/ShipControls';
import Vector from '../utils/Vector';

export const ThreeBodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  const { planets, star } = state;
  return (
    <group>
      {planets.map((p) => (
        <ThreePlanetShape
          onClick={(evt: any) => {
            console.log(evt);
            actionsActive[ShipActionType.Navigate] = ShipAction.Navigate(
              new Vector(0, 0)
            );
          }}
          position={posToThreePos(p.x, p.y)}
          key={p.id}
          scale={_.times(3, () => p.radius) as [number, number, number]}
          color={p.color}
        />
      ))}
      {star && (
        <ThreeStar
          scale={_.times(3, () => star.radius) as [number, number, number]}
          position={posToThreePos(star.x, star.y)}
          color={star.color}
        />
      )}
    </group>
  );
};
