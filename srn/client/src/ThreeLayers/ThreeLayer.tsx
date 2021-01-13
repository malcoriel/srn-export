import { Canvas, MouseEvent } from 'react-three-fiber';
import { Vector3 } from 'three';
import { max_x, min_x, ShipAction, ShipActionType, size } from '../world';
import React, { Suspense, useEffect, useState } from 'react';
import { ThreeShipsLayer } from './ThreeShipsLayer';
import {
  ExternalCameraControl,
  BoundCameraMover,
  CameraZoomer,
  CAMERA_HEIGHT,
  CAMERA_DEFAULT_ZOOM,
} from './CameraControls';
import { ThreeBodiesLayer } from './ThreeBodiesLayer';
import NetState, { useNSForceChange } from '../NetState';
import Vector from '../utils/Vector';
import { actionsActive } from '../utils/ShipControls';
import { BackgroundPlane } from './BackgroundPlane';
import { useShowCoordinates } from '../KonvaLayers/CoordLayer';

// x -> x, y -> -y to keep the axes orientation corresponding to the physics  (y down),
// xy is visible plane, z towards camera
export const posToThreePos = (
  x: number,
  y: number,
  z?: number
): [number, number, number] => [x, -y, z || 0];

export const threePosToVector = (x: number, y: number, _z: number): Vector =>
  new Vector(x, -y);

// noinspection JSUnusedLocalSymbols
export const threeVectorToVector = ({
  x,
  y,
  z,
}: {
  x: number;
  y: number;
  z: number;
}): Vector => new Vector(x, -y);

export const ThreeLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state } = ns;
  const [shown] = useShowCoordinates();
  const showCoords = shown;

  useNSForceChange(true);

  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: CAMERA_DEFAULT_ZOOM(),
        far: 1000,
      }}
      style={{
        position: 'absolute',
        width: size.width_px,
        height: size.height_px,
      }}
    >
      {/* red is first  coord (x) */}
      {/* green is second  coord (y) */}
      {/* blue is third coord (z) */}
      <Suspense fallback={<mesh />}>
        <group
          onClick={(evt: MouseEvent) => {
            const pos = threeVectorToVector(evt.point);
            actionsActive[ShipActionType.Navigate] = ShipAction.Navigate(
              Vector.fromIVector(pos)
            );
          }}
        >
          {/*background plane serves to be a click helper, as otherwise
          three will not register clicks (through empty space)*/}
          <BackgroundPlane />
          <ExternalCameraControl />
          <CameraZoomer />
          <BoundCameraMover />
          <ambientLight />
          {showCoords && (
            <gridHelper
              args={[max_x - min_x, (max_x - min_x) / 10]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          )}
          <pointLight position={[0, 0, CAMERA_HEIGHT]} />
          <ThreeBodiesLayer state={state} />
          <ThreeShipsLayer state={state} />
        </group>
      </Suspense>
    </Canvas>
  );
};
