import React, { useMemo } from 'react';
import Vector, { VectorF } from '../../utils/Vector';
import { vecToThreePos } from '../ThreeLayer';
import { EasingFunctions } from './EasingFunctions';

export const calcBeamParams = (start: Vector, end: Vector) => {
  const vector = end.subtract(start);
  const angle = VectorF(0, 1).angleRad(vector);
  const medianPoint = new Vector(start.x + end.x, start.y + end.y).scale(0.5);
  return {
    length: vector.length(),
    rotation: vector.x < 0 ? angle : -angle,
    position: vecToThreePos(medianPoint),
  };
};

export const ThreeLaserBeam: React.FC<{
  start: Vector;
  end: Vector;
  progression: number;
}> = ({ start, end, progression }) => {
  const beamParams = useMemo(() => calcBeamParams(start, end), [start, end]);
  return (
    <mesh
      position={beamParams.position}
      rotation={[0, 0, -beamParams.rotation]}
    >
      <planeGeometry args={[3, beamParams.length, 1]} />
      <meshBasicMaterial
        color="red"
        opacity={EasingFunctions.easeInCubic((50 + progression / 2) / 100)}
        transparent
      />
    </mesh>
  );
};
