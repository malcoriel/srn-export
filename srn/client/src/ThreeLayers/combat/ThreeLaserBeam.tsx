import React, { useMemo } from 'react';
import Vector, {
  getCounterClockwiseAngleMath,
  VectorF,
} from '../../utils/Vector';
import { EasingFunctions } from './EasingFunctions';
import { vecToThreePos, vecToThreePosInv } from '../util';

const getAngleFromEndToStart = (
  end: Vector,
  start: Vector
): { vector: Vector; rotation: number } => {
  const vector = end.subtract(start);
  const angle = getCounterClockwiseAngleMath(VectorF(0, 1), vector);
  return { vector, rotation: angle };
};

export const calcBeamParams = (start: Vector, end: Vector) => {
  const { vector, rotation } = getAngleFromEndToStart(end, start);

  const medianPoint = new Vector(start.x + end.x, start.y + end.y).scale(0.5);
  return {
    length: vector.length(),
    rotation,
    position: vecToThreePosInv(medianPoint),
  };
};

export const ThreeLaserBeam: React.FC<{
  start: Vector;
  end: Vector;
  width?: number;
  color?: string;
  // 0-100
  progression: number;
}> = ({ start, end, progression, width = 1, color = 'red' }) => {
  const beamParams = useMemo(() => calcBeamParams(start, end), [start, end]);
  return (
    <mesh position={beamParams.position} rotation={[0, 0, beamParams.rotation]}>
      <planeGeometry args={[width, beamParams.length, 1]} />
      <meshBasicMaterial
        color={color}
        opacity={EasingFunctions.easeInCubic((50 + progression / 2) / 100)}
        transparent
      />
    </mesh>
  );
};
