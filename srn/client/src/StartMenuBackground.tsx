import React from 'react';
import { Vector3 } from 'three';
import { CAMERA_HEIGHT } from './ThreeLayers/CameraControls';
import { size, viewPortSizeMeters } from './coord';
import { ThreeSpaceBackground } from './ThreeLayers/ThreeSpaceBackground';
import { Canvas } from '@react-three/fiber';

export const StartMenuBackground = () => {
  const viewPortSize = viewPortSizeMeters();
  const viewPortMaxDimension = Math.max(viewPortSize.x, viewPortSize.y);
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: 10.0,
        far: 1000,
      }}
      style={{
        position: 'absolute',
        width: size.width_px,
        height: size.height_px,
      }}
    >
      <ThreeSpaceBackground
        shaderShift={5}
        boost={10.0}
        size={viewPortMaxDimension * 17.0}
        animationSpeed={3}
      />
    </Canvas>
  );
};
