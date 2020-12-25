import { GameState } from './common';
import { Layer } from 'react-konva';
import { PlanetShape } from './PlanetShape';
import React from 'react';

export const PlanetsLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { planets } = state;
  return (
    <Layer>
      {planets.map((p) => (
        <PlanetShape key={p.id} {...p} />
      ))}
    </Layer>
  );
};
