import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3 } from 'three';
import React, { MutableRefObject, Suspense } from 'react';
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
import Vector from '../utils/Vector';
import { actionsActive } from '../utils/ShipControls';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { useStore } from '../store';
import { size, viewPortSizeMeters } from '../coord';
import { ThreeQuestDirection } from './ThreeQuestDirection';
import { ThreeNames } from './ThreeNames';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { ThreeWeaponEffectsLayer } from './ThreeWeaponEffectsLayer';
import { ShipActionRustBuilder } from '../../../world/pkg/world.extra';
import { ThreeTrajectoryLayer } from './ThreeTrajectoryLayer';
import { ThreeEvent } from '@react-three/fiber/dist/declarations/src/core/events';
import { seedToNumber, threeVectorToVector } from './util';
import { SuspendedThreeLoader } from './Preload';

THREE.Cache.enabled = true;

const SAFE_ENLARGE_BACKGROUND = 5.0;

const getViewPortMaxDimension = () => {
  const viewPortSize = viewPortSizeMeters();
  return Math.max(viewPortSize.x, viewPortSize.y);
};

export const getBackgroundSize = (cameraZoomFactor = 1.0) => {
  const viewPortMaxDimension = getViewPortMaxDimension();
  return viewPortMaxDimension * SAFE_ENLARGE_BACKGROUND * cameraZoomFactor;
};

export const ThreeLayer: React.FC<{
  visible: boolean;
  playing: boolean;
}> = ({ visible, playing }) => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visMap, visualState, indexes } = ns;
  const [shown] = useToggleHotkey('shift+g', false, 'show helper grid');
  const showCoords = shown;

  useNSForceChange('ThreeLayer', true);

  const hoverOnGrabbable = useStore((state) => state.showTractorCircle);

  return (
    <Canvas
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
        <SuspendedThreeLoader playing={playing} />
        <group
          visible={visible}
          onClick={(evt: ThreeEvent<MouseEvent>) => {
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
          <ThreeShipsLayer state={state} visMap={visMap} indexes={indexes} />
          <ThreeQuestDirection state={state} visualState={visualState} />
          <ThreeNames netState={ns} visMap={visMap} />
          <ThreeWeaponEffectsLayer />
          <ThreeTrajectoryLayer indexes={indexes} />
          {/*<ThreeWormhole position={posToThreePos(50, 50)} radius={3} />*/}
        </group>
      </Suspense>
    </Canvas>
  );
};
