import React from 'react';
import Vector, { IVector, VectorF } from '../utils/Vector';
import { vecToThreePos } from './util';
import { Text } from '@react-three/drei';
import { teal } from '../utils/palette';
import { ThreeTrajectoryItem } from './ThreeTrajectoryItem';

/**
 * @param markers
 * ↑ - gas forward, ↓ - gas backwards
 * ↷ - rotation clockwise in math coords
 * ↶ - rotation counter-clockwise in math coords
 * ← - strafe left
 * → - strafe right
 * @constructor
 */
export const MovementMarkers: React.FC<{
  markers: string;
  position: IVector;
  velocity: IVector;
  radius: number;
}> = ({ markers, position, radius, velocity }) => {
  // noinspection PointlessArithmeticExpressionJS
  return (
    <group position={vecToThreePos(position, 0)}>
      <Text
        visible
        position={vecToThreePos(VectorF(0, -(radius + 3)))}
        color={teal}
        font="resources/fonts/DejaVuSans.ttf"
        fontSize={3.0}
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="left"
        anchorX="center"
        anchorY="bottom"
      >
        {markers}
      </Text>
      <ThreeTrajectoryItem
        mainColor={teal}
        accNormalized={VectorF(0, 0)}
        position={VectorF(radius, radius)}
        velocityNormalized={Vector.fromIVector(velocity).normalize()}
        radius={radius * 1.0} // radius of the speed display
      />
    </group>
  );
};
