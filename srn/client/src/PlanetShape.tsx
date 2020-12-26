import React from 'react';
import { antiScale, Planet, radToDeg, scaleConfig } from './common';
import { Circle, Group, RegularPolygon, Text } from 'react-konva';

export const PlanetShape: React.FC<Planet> = (p) => {
  return (
    <Group x={p.x} y={p.y}>
      <Text
        {...antiScale}
        text={p.name}
        align="center"
        offsetY={scaleConfig.scaleX * p.radius + 20}
        width={200}
        offsetX={100}
      />
      <Circle
        key={p.id}
        radius={p.radius}
        fill="red"
        border={0.1}
        opacity={0.5}
        shadowBlur={5}
      />
    </Group>
  );
};
