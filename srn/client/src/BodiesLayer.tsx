import { GameState, height_units, min_x, min_y, width_units } from './world';
import { Layer, Rect } from 'react-konva';
import { PlanetShape } from './PlanetShape';
import React from 'react';

export const BodiesLayer: React.FC<{
  state: GameState;
  enableBodies: boolean;
}> = ({ state, enableBodies }) => {
  if (!state) return null;
  const { planets, star } = state;
  return (
    <Layer>
      <Rect
        width={width_units}
        fill="transparent"
        height={height_units}
        x={min_x}
        y={min_y}
      />
      {planets.map((p) => (
        <PlanetShape key={p.id} {...p} drawBody={enableBodies} />
      ))}
      {star && <PlanetShape {...star} drawBody={enableBodies} />}
    </Layer>
  );
};
