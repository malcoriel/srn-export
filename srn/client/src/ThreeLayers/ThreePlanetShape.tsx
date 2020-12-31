import React from 'react';
import { Planet } from '../world';
import _ from 'lodash';
import { Sphere } from './Sphere';
import { posToThreePos } from './ThreeLayer';

export const ThreePlanetShape: React.FC<Planet & { star?: boolean }> = (p) => {
  const scale = _.times(3, () => p.radius) as [number, number, number];
  return (
    <Sphere
      position={posToThreePos(p.x, p.y)}
      key={p.id}
      scale={scale}
      color={p.color}
      star={p.star}
    />
  );
};
