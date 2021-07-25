import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';

export const StoryCanvas: React.FC<{ styles?: any }> = ({
  children,
  styles,
}) => {
  return (
    <Canvas
      orthographic
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT + 100),
        zoom: 1.0,
        far: 1000,
      }}
      style={{
        display: 'inline-block',
        width: 256,
        height: 256,
        ...styles,
      }}
    >
      <Suspense fallback={<mesh />}>
        <ambientLight />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <group position={[0, 0, 0]}>{children}</group>
      </Suspense>
    </Canvas>
  );
};
