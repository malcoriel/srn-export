import _ from 'lodash';
import { Arrow, Layer, Line, Text } from 'react-konva';
import { antiScale, max_x, max_y, min_x, min_y } from './common';
import React from 'react';

export const CoordLayer = () => {
  const numberPoints = _.times(4, (i) => 10 + i * 10);
  return (
    <Layer>
      <Arrow
        points={[0, min_y, 0, max_y]}
        pointerWidth={1}
        pointerLength={1}
        stroke="white"
        dash={[1, 0.5]}
        opacity={0.3}
        strokeWidth={0.1}
      />
      <Arrow
        points={[min_x, 0, max_x, 0]}
        pointerWidth={1}
        pointerLength={1}
        stroke="white"
        dash={[1, 0.5]}
        opacity={0.3}
        strokeWidth={0.1}
      />
      <Line
        points={[min_x, min_y, min_x, max_x]}
        stroke="white"
        opacity={0.3}
        strokeWidth={0.5}
      />
      <Line
        points={[min_x, min_y, max_x, min_y]}
        stroke="white"
        opacity={0.3}
        strokeWidth={0.5}
      />
      <Line
        points={[max_x, min_y, max_x, max_y]}
        stroke="white"
        opacity={0.3}
        strokeWidth={0.5}
      />
      <Line
        points={[max_x, max_y, min_x, max_y]}
        stroke="white"
        opacity={0.3}
        strokeWidth={0.5}
      />
      {numberPoints.map((p) => (
        <Text fill="white" key={p} text={`${p}`} x={p} y={1} {...antiScale} />
      ))}
      {numberPoints.map((p) => (
        <Text fill="white" key={p} text={`${p}`} x={1} y={p} {...antiScale} />
      ))}
      {numberPoints.map((p) => (
        <Text fill="white" key={p} text={`-${p}`} x={1} y={-p} {...antiScale} />
      ))}
      {numberPoints.map((p) => (
        <Text fill="white" key={p} text={`-${p}`} x={-p} y={1} {...antiScale} />
      ))}
    </Layer>
  );
};
