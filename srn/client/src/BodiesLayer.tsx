import { GameState, height_units, min_x, min_y, width_units } from './common';
import { Group, Layer, Rect } from 'react-konva';
import { PlanetShape } from './PlanetShape';
import React from 'react';

export const BodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { planets, star } = state;
  return (
    <Layer>
      <Rect
        width={width_units}
        fill="black"
        height={height_units}
        x={min_x}
        y={min_y}
      />
      {planets.map((p) => (
        <PlanetShape key={p.id} {...p} />
      ))}
      {star && <PlanetShape key={star.id} {...star} />}
    </Layer>
  );
};
