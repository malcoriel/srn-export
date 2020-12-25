import React, { useRef, useState } from 'react';
import { Group, RegularPolygon, Text } from 'react-konva';
import { antiScale, radToDeg, Ship } from './common';

export const ShipShape: React.FC<Ship & { name: string }> = (shipProps) => {
  const ref = useRef(null);
  const [textWidth, setTextWidth] = useState(50);

  if (ref.current) {
    // @ts-ignore
    const width = ref.current.getWidth();
    if (width !== textWidth) {
      setTextWidth(width);
      console.log({ width });
    }
  }

  return (
    <Group x={shipProps.x} y={shipProps.y}>
      <Text
        ref={ref}
        {...antiScale}
        text={shipProps.name}
        align="center"
        offsetX={textWidth / 2}
        offsetY={30}
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
