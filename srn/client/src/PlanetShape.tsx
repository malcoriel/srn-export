import React from 'react';
import { Planet } from './common';
import { Circle } from 'react-konva';

export const PlanetShape: React.FC<Planet> = (p) => (
  <Circle
    key={p.id}
    x={p.x}
    y={p.y}
    radius={p.radius}
    fill="red"
    border={0.1}
    opacity={0.5}
    shadowBlur={5}
  />
);
