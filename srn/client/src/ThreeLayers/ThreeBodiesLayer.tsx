import React from 'react';
import { GameState } from '../world';
import { ThreePlanetShape } from './ThreePlanetShape';

export const ThreeBodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { planets, star } = state;
  return (
    <group>
      {planets.map((p) => (
        <ThreePlanetShape key={p.id} {...p} />
      ))}
      {star && <ThreePlanetShape star={true} key={star.id} {...star} />}
    </group>
  );
};
