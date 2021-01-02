import { height_units, width_units } from '../world';
import React, { useRef } from 'react';

export const BackgroundPlane = () => {
  return (
    <mesh position={[0, 0, -10]}>
      <planeBufferGeometry args={[width_units, height_units]} />
      <meshBasicMaterial color="black" />
    </mesh>
  );
};
