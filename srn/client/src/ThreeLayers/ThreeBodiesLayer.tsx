import React from 'react';
import _ from 'lodash';
import { GameState } from '../world';
import { ThreeStar } from './ThreeStar';
import { VisualState } from '../NetState';
import { MineralsLayer } from './MineralsLayer';
import { ContainersLayer } from './ContainersLayer';
import { ThreePlanetsLayer } from './ThreePlanetsLayer';
import { AsteroidBeltsLayer } from './AsteroidBeltsLayer';
import { posToThreePos } from './util';
import { ClientStateIndexes, findMyShip } from '../ClientStateIndexing';

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
