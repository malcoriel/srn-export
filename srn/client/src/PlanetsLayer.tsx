import useSWR from 'swr';
import { GameState } from './common';
import { Layer } from 'react-konva';
import { PlanetShape } from './PlanetShape';
import React from 'react';

export const PlanetsLayer = () => {
  const { data: state } = useSWR<GameState>('http://localhost:8000/api/state');
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
