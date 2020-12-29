import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import { height_px, width_px } from '../world';
import { TexturedSphere } from './Sphere';
import React from 'react';

export const ThreeLayer = () => (
  <Canvas
    orthographic
    camera={{
      position: new Vector3(0, 100, 0),
    }}
    style={{
      position: 'absolute',
      top: 5,
      left: 5,
      backgroundColor: 'transparent',
      width: width_px,
      height: height_px,
    }}
  >
    {/* blue is third coord (z?) */}
    {/* green is second  coord (y?) */}
    {/* red is first  coord (x?) */}
    <ambientLight />
    <pointLight position={[10, 10, 10]} />
    <TexturedSphere position={[0, 0, 0]} />
    <TexturedSphere position={[100, 0, 0]} />
    <axesHelper args={[100]} position={[0, 0, 0]} />
  </Canvas>
);
