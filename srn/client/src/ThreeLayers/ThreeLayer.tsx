import { Canvas, MouseEvent } from 'react-three-fiber';
import { Vector3 } from 'three';
import React, { Suspense } from 'react';
import classnames from 'classnames';
import {
  findMineral,
  max_x,
  min_x,
  ShipAction,
  ShipActionType,
} from '../world';
import { ThreeShipsLayer } from './ThreeShipsLayer';
import {
  BoundCameraMover,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
  CameraZoomer,
  ExternalCameraControl,
} from './CameraControls';
import { ThreeBodiesLayer } from './ThreeBodiesLayer';
import NetState, { useNSForceChange } from '../NetState';
import Vector, { IVector } from '../utils/Vector';
import { actionsActive } from '../utils/ShipControls';
import { BackgroundPlane } from './BackgroundPlane';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { useStore } from '../store';
import { size } from '../coord';

export type Vector3Arr = [number, number, number];

// x -> x, y -> -y to keep the axes orientation corresponding to the physics  (y down),
// xy is visible plane, z towards camera
export const posToThreePos = (x: number, y: number, z?: number): Vector3Arr => [
  x,
  -y,
  z || 0,
];

export const vecToThreePos = (v: IVector): Vector3Arr => [v.x, -v.y, 0];

// noinspection JSUnusedGlobalSymbols
export const threePosToVector = (x: number, y: number, _z: number): Vector =>
  new Vector(x, -y);

// noinspection JSUnusedLocalSymbols
export const threeVectorToVector = ({
  x,
  y,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  z,
}: {
  x: number;
  y: number;
  z: number;
}): Vector => new Vector(x, -y);

export const ThreeLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visMap } = ns;
  const [shown] = useToggleHotkey('shift+g', false, 'show helper grid');
  const showCoords = shown;

  useNSForceChange('ThreeLayer', true);

  const hintedObjectId = useStore((state) => state.hintedObjectId);
  const hoverOnGrabbable = !!(hintedObjectId
    ? findMineral(ns.state, hintedObjectId)
    : undefined);

  return (
    <Canvas
      invalidateFrameloop
      className={classnames({ grabbable: hoverOnGrabbable })}
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
          <ThreeBodiesLayer state={state} visMap={visMap} />
          <ThreeShipsLayer state={state} visMap={visMap} />
        </group>
      </Suspense>
    </Canvas>
  );
};
