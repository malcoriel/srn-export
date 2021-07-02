import { Canvas, MouseEvent } from 'react-three-fiber';
import { Vector3 } from 'three';
import React, { Suspense } from 'react';
import classnames from 'classnames';
import 'loaders.css';
import { max_x, min_x } from '../world';
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
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { useStore } from '../store';
import { size, viewPortSizeMeters } from '../coord';
import { ThreeQuestDirection } from './ThreeQuestDirection';
import { ThreeNames } from './ThreeNames';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { ThreeWeaponEffectsLayer } from './ThreeWeaponEffectsLayer';
import { ShipActionRustBuilder } from '../../../world/pkg/world.extra';

export type Vector3Arr = [number, number, number];

const seedToNumber = (seed: string) => {
  try {
    return Number(`0x${seed}`) || 0;
  } catch (e) {
    return 0;
  }
};

// x -> x, y -> -y to keep the axes orientation corresponding to the physics  (y down),
// xy is visible plane, z towards camera
export const posToThreePos = (x: number, y: number, z?: number): Vector3Arr => [
  x,
  -y,
  z || 0,
];

export const vecToThreePos = (v: IVector, lift = 0): Vector3Arr => [
  v.x,
  -v.y,
  lift,
];

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

const ResourceLoader = () => {
  return <primitive object={{}} />;
};

const SAFE_ENLARGE_BACKGROUND = 5.0;

const getViewPortMaxDimension = () => {
  const viewPortSize = viewPortSizeMeters();
  return Math.max(viewPortSize.x, viewPortSize.y);
};

export const getBackgroundSize = (cameraZoomFactor = 1.0) => {
  const viewPortMaxDimension = getViewPortMaxDimension();
  return viewPortMaxDimension * SAFE_ENLARGE_BACKGROUND * cameraZoomFactor;
};

export const ThreeLayer: React.FC<{ visible: boolean }> = ({ visible }) => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visMap, visualState } = ns;
  const [shown] = useToggleHotkey('shift+g', false, 'show helper grid');
  const showCoords = shown;

  useNSForceChange('ThreeLayer', true);

  const hoverOnGrabbable = useStore((state) => state.showTractorCircle);

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
        <ResourceLoader />
      </Suspense>
      <Suspense fallback={<mesh />}>
        <group
          visible={visible}
          onClick={(evt: MouseEvent) => {
            const pos = threeVectorToVector(evt.point);
            actionsActive.Navigate = ShipActionRustBuilder.ShipActionRustNavigate(
              { target: Vector.fromIVector(pos) }
            );
          }}
        >
          {/*background plane serves to be a click helper, as otherwise
          three will not register clicks (through empty space)*/}
          <ThreeSpaceBackground
            shaderShift={seedToNumber(state.seed) % 1000}
            cameraPositonParallaxed
            size={getBackgroundSize()}
            cameraBound
          />
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
          <ThreeBodiesLayer
            state={state}
            visMap={visMap}
            visualState={visualState}
          />
          <ThreeShipsLayer state={state} visMap={visMap} />
          <ThreeQuestDirection state={state} visualState={visualState} />
          <ThreeNames netState={ns} visMap={visMap} />
          <ThreeWeaponEffectsLayer />
        </group>
      </Suspense>
    </Canvas>
  );
};

export const liftThreePos = (zShift: number) => (
  threeArrVec: [number, number, number]
): [number, number, number] => [
  threeArrVec[0],
  threeArrVec[1],
  threeArrVec[2] + zShift,
];
