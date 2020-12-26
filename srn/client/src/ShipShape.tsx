import React from 'react';
import { Group, RegularPolygon, Text } from 'react-konva';
import { antiScale, radToDeg, Ship } from './common';

export const ShipShape: React.FC<Ship & { name: string }> = (shipProps) => {
  return (
    <Group x={shipProps.x} y={shipProps.y}>
      <Text
        {...antiScale}
        text={shipProps.name}
        align="center"
        offsetY={30}
        width={200}
        offsetX={100}
      />
      <Group key={shipProps.id} rotation={radToDeg(shipProps.rotation)}>
        <RegularPolygon
          x={0}
          y={-0.5}
          sides={3}
          scaleX={0.8}
          radius={shipProps.radius}
          fill="blue"
          stroke="black"
          strokeWidth={0.05}
          lineJoin="bevel"
        />
        <RegularPolygon
          x={0}
          y={0.5}
          sides={3}
          radius={shipProps.radius}
          fill="blue"
          stroke="black"
          strokeWidth={0.05}
          lineJoin="bevel"
        />
      </Group>
    </Group>
  );
};
