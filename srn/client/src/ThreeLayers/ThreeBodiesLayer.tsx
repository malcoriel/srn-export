import React from 'react';
import _ from 'lodash';
import { GameState } from '../world';
import { ThreeStar } from './ThreeStar';
import { posToThreePos } from './ThreeLayer';
import { VisualState } from '../NetState';
import { MineralsLayer } from './MineralsLayer';
import { ContainersLayer } from './ContainersLayer';
import { ThreePlanetsLayer } from './ThreePlanetsLayer';
import { AsteroidBeltsLayer } from './AsteroidBeltsLayer';

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
  // const selectedObjectId = useStore((state) => state.selectedObjectId);
  // const onReportSelected = useStore((state) => state.onReportSelected);

  return (
    <group>
      <ThreePlanetsLayer planets={planets} visMap={visMap} />
      {star && (
        <ThreeStar
          key={star.id}
          timeScale={0.5}
          visualState={visualState}
          visible={visMap[star.id]}
          scale={_.times(3, () => star.radius) as [number, number, number]}
          position={posToThreePos(star.x, star.y)}
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
