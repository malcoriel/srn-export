import React from 'react';
import { GameState, ShipAction, ShipActionType } from '../world';
import _ from 'lodash';
import { ThreeStar } from './ThreeStar';
import { posToThreePos } from './ThreeLayer';
import { ThreePlanetShape } from './ThreePlanetShape';
import { MouseEvent } from 'react-three-fiber';
import { actionsActive } from '../utils/ShipControls';
import { ThreeAsteroidBelt } from './ThreeAsteroidBelt';
import { ThreeRock } from './ThreeRock';

export const ThreeBodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  const { planets, star, asteroids, minerals, asteroid_belts } = state;
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
      {asteroid_belts.map((b) => (
        <ThreeAsteroidBelt
          key={b.id}
          count={b.count}
          radius={b.radius}
          position={posToThreePos(b.x, b.y)}
          width={b.width}
          rotation={[0, 0, b.rotation]}
          gid={b.id}
          scale_mod={b.scale_mod}
        />
      ))}
      {minerals.map((m) => (
        <ThreeRock
          key={m.id}
          radius={m.radius}
          position={posToThreePos(m.x, m.y)}
          color={m.color}
        />
      ))}
      {/*{asteroids.map((a: Asteroid) => (*/}
      {/*  <ThreeRock*/}
      {/*    key={a.id}*/}
      {/*    position={posToThreePos(a.x, a.y)}*/}
      {/*    scale={_.times(3, () => a.radius) as [number, number, number]}*/}
      {/*  />*/}
      {/*))}*/}
    </group>
  );
};
