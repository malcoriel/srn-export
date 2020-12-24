import React from 'react';
import { Group, RegularPolygon } from 'react-konva';
import { radToDeg, Ship } from './common';

export const ShipShape: React.FC<Ship> = (shipProps) => (
  <Group key={shipProps.id} rotation={radToDeg(shipProps.rotation)}>
    <RegularPolygon
      x={shipProps.x}
      y={shipProps.y - 0.5}
      sides={3}
      scaleX={0.8}
      radius={shipProps.radius}
      fill="blue"
      stroke="black"
      strokeWidth={0.05}
      lineJoin="bevel"
    />
    <RegularPolygon
      x={shipProps.x}
      y={shipProps.y + 0.5}
      sides={3}
      radius={shipProps.radius}
      fill="blue"
      stroke="black"
      strokeWidth={0.05}
      lineJoin="bevel"
    />
  </Group>
);
