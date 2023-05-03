import React from 'react';
import _ from 'lodash';
import { Asteroid, GameState } from '../world';
import { ThreeStar } from './ThreeStar';
import { VisualState } from '../NetState';
import { MineralsLayer, rarityToColorArr } from './MineralsLayer';
import { ContainersLayer } from './ContainersLayer';
import { ThreePlanetsLayer } from './ThreePlanetsLayer';
import { AsteroidBeltsLayer } from './AsteroidBeltsLayer';
import { posToThreePos } from './util';
import { InteractorMap } from './InteractorMap';
import { ThreeFloatingObject } from './ThreeFloatingObject';

export const ThreeBodiesLayer: React.FC<{
  state: GameState;
  visualState: VisualState;
  visMap: Record<string, boolean>;
}> = ({ visMap, state, visualState }) => {
  const {
    planets,
    star,
    minerals,
    asteroid_belts,
    containers,
    asteroids,
  } = state.locations[0];

  return (
    <group>
      <ThreePlanetsLayer planets={planets} visMap={visMap} />
      {star && (
        <ThreeStar
          key={star.id}
          timeScale={0.5}
          visualState={visualState}
          visible={visMap[star.id]}
          scale={
            _.times(3, () => star.spatial.radius) as [number, number, number]
          }
          position={posToThreePos(
            star.spatial.position.x,
            star.spatial.position.y
          )}
          color={star.color}
          coronaColor={star.corona_color}
        />
      )}
      <AsteroidBeltsLayer asteroid_belts={asteroid_belts} />
      <MineralsLayer minerals={minerals} />
      <ContainersLayer containers={containers} />
      {asteroids.map((a: Asteroid) => (
        <ThreeFloatingObject
          gid={a.id}
          scale={1.0}
          key={a.id}
          radius={a.spatial.radius}
          position={posToThreePos(a.spatial.position.x, a.spatial.position.y)}
          colors={['#eee']}
          modelName="asteroid.glb"
        />
      ))}
    </group>
  );
};
