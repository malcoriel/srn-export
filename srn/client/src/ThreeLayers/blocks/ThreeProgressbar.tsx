import React from 'react';
import { Vector3Arr } from '../util';

export const ThreeProgressbar: React.FC<{
  hideWhenFull?: boolean;
  fillColor: string;
  backgroundColor: string;
  length: number;
  girth: number;
  completionNormalized: number;
  position?: Vector3Arr;
}> = ({
  fillColor,
  position,
  completionNormalized,
  backgroundColor,
  length,
  girth,
  hideWhenFull,
}) => {
  const leftShift = ((1 - completionNormalized) * length) / 2;
  const hidden = hideWhenFull && Math.abs(1.0 - completionNormalized) < 0.01;
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}>
        <planeBufferGeometry args={[length, girth]} />
        <meshBasicMaterial
          transparent
          color={backgroundColor}
          opacity={hidden ? 0.0 : 1.0}
        />
      </mesh>
      <mesh position={[-leftShift, 0, 0.0001]}>
        <planeBufferGeometry args={[length * completionNormalized, girth]} />
        <meshBasicMaterial
          color={fillColor}
          opacity={hidden ? 0.0 : 1.0}
          transparent
        />
      </mesh>
    </group>
  );
};
