import React from 'react';
import { antiScale, Planet, scaleConfig } from './world';
import { Circle, Group, Text } from 'react-konva';

export const PlanetShape: React.FC<Planet & { drawBody: boolean }> = (p) => {
  return (
    <Group x={p.x} y={p.y}>
      <Text
        {...antiScale}
        text={p.name}
        fill="white"
        align="center"
        offsetY={scaleConfig.scaleX * p.radius + 20}
        width={200}
        offsetX={100}
      />
      {p.drawBody && (
        <Circle
          key={p.id}
          radius={p.radius}
          fill={p.color}
          stroke="gray"
          strokeWidth={0.05}
        />
      )}
    </Group>
  );
};
