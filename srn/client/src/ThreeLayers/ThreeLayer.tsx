import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import { GameState, height_px, unitsToPixels, width_px } from '../world';
import React, { Suspense } from 'react';
import { ThreeShipsLayer } from './ThreeShipsLayer';
import { CameraMover } from './CameraMover';
import { ThreeBodiesLayer } from './ThreeBodiesLayer';
import NetState from '../NetState';

// x -> x, y -> -y to keep the axes orientation corresponding to the physics  (y down),
// xy is visible plane, z towards camera
export const posToThreePos = (
  x: number,
  y: number,
  z?: number
): [number, number, number] => [x, -y, z || 0];

export const CAMERA_HEIGHT = 50;

export const ThreeLayer: React.FC = () => {
  const { state } = NetState.get();
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: unitsToPixels,
        far: 1000,
      }}
      style={{
        position: 'absolute',
        top: 5,
        left: 5,
        width: width_px,
        height: height_px,
      }}
    >
      <Suspense fallback={<mesh />}>
        <axesHelper position={posToThreePos(15, 15)} args={[20]} />
        <CameraMover />
        <ambientLight />
        <gridHelper args={[100, 10]} rotation={[Math.PI / 2, 0, 0]} />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <ThreeBodiesLayer state={state} />
        <ThreeShipsLayer state={state} />
        {/*<Sphere position={[0, 0, 0]} scale={[10, 10, 10]} star />*/}
      </Suspense>
      {/* blue is third coord (z?) */}
      {/* green is second  coord (y?) */}
      {/* red is first  coord (x?) */}
    </Canvas>
  );
};
