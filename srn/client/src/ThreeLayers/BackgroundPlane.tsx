import { height_units, width_units } from '../world';
import React from 'react';

export const BackgroundPlane = () => (
  <mesh position={[0, 0, -10]}>
    <planeBufferGeometry args={[width_units, height_units]} />
    <meshBasicMaterial color="black" />
  </mesh>
);
