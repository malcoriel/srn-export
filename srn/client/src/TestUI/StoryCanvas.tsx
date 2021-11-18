import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';

export const StoryCanvasInternals: React.FC = ({ children }) => {
  return (
    <Suspense fallback={<mesh />}>
      <ambientLight />
      <pointLight position={[0, 0, CAMERA_HEIGHT]} />
      <group name="story-canvas-internals-main" position={[0, 0, 0]}>
        {children}
      </group>
    </Suspense>
  );
};

export const StoryCanvas: React.FC<{
  styles?: any;
  zoom?: number;
  scale?: number;
  withBackground?: boolean;
}> = ({ children, styles, zoom = 1.0, scale = 1.0, withBackground }) => {
  return (
    <Canvas
      orthographic
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT + 100),
        zoom,
        far: 1000,
      }}
      style={{
        display: 'inline-block',
        width: 256 * scale,
        height: 256 * scale,
        ...styles,
      }}
    >
      <StoryCanvasInternals>
        {withBackground && (
          <ThreeSpaceBackground size={256 * scale} shaderShift={0} />
        )}
        {children}
      </StoryCanvasInternals>
    </Canvas>
  );
};
