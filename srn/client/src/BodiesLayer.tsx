import { GameState } from './common';
import { Layer } from 'react-konva';
import { PlanetShape } from './PlanetShape';
import React from 'react';

export const BodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { planets, star } = state;
  return (
    <Layer>
      {planets.map((p) => (
        <PlanetShape key={p.id} {...p} />
      ))}
      {star && <PlanetShape key={star.id} {...star} />}
    </Layer>
  );
};
