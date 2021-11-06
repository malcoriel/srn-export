import React from 'react';
import { Vector3Arr } from '../util';

export const ThreeProgressbar: React.FC<{
  fillColor: string;
  backgroundColor: string;
  length: number;
  girth: number;
  completion: number;
  position?: Vector3Arr;
}> = ({ fillColor, position, completion, backgroundColor, length, girth }) => {
  const leftShift = ((1 - completion) * length) / 2;
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}>
        <planeBufferGeometry args={[length, girth]} />
        <meshBasicMaterial color={backgroundColor} />
      </mesh>
      <mesh position={[-leftShift, 0, 0.0001]}>
        <planeBufferGeometry args={[length * completion, girth]} />
        <meshBasicMaterial color={fillColor} />
      </mesh>
    </group>
  );
};
