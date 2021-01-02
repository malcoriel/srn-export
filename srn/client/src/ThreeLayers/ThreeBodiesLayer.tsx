import React from 'react';
import { GameState, ShipAction, ShipActionType } from '../world';
import _ from 'lodash';
import { ThreeStar } from './ThreeStar';
import { posToThreePos, threeVectorToVector } from './ThreeLayer';
import { ThreePlanetShape } from './ThreePlanetShape';
import { MouseEvent } from 'react-three-fiber';
import { actionsActive } from '../utils/ShipControls';

export const ThreeBodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  const { planets, star } = state;
  return (
    <group>
      {planets.map((p) => (
        <ThreePlanetShape
          onClick={(evt: MouseEvent) => {
            evt.stopPropagation();
            actionsActive[
              ShipActionType.DockNavigate
            ] = ShipAction.DockNavigate(p.id);
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
