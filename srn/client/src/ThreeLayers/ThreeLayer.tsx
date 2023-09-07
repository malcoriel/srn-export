import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3 } from 'three';
import React, { Suspense, useRef } from 'react';
import classnames from 'classnames';
import 'loaders.css';
import { GameMode, max_x, min_x } from '../world';
import { ThreeShipsLayer } from './ThreeShipsLayer';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
  CameraController,
} from './CameraControls';
import { ThreeBodiesLayer } from './ThreeBodiesLayer';
import NetState, { DISPLAY_BREADCRUMBS_LAST_TICKS } from '../NetState';
import Vector from '../utils/Vector';
import { useToggleHotkey } from '../utils/hotkeyHooks';
import { useStore } from '../store';
import { size, viewPortSizeMeters } from '../coord';
import { ThreeQuestDirection } from './ThreeQuestDirection';
import { ThreeNames } from './ThreeNames';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { ThreeWeaponEffectsLayer } from './ThreeWeaponEffectsLayer';
import { ActionBuilder } from '../../../world/pkg/world.extra';
import { ThreeTrajectoryLayer } from './ThreeTrajectoryLayer';
import { ThreeEvent } from '@react-three/fiber/dist/declarations/src/core/events';
import { seedToNumber, threeVectorToVector } from './util';
import { ThreeLoadingIndicator } from './Resources';
import { useNSForceChange } from '../NetStateHooks';
import { ThreeBreadcrumbs } from './ThreeBreadcrumbs';
import { executeSyncAction } from '../utils/ShipControls';
import { OrthographicCamera, Text } from '@react-three/drei';
import { ThreeCameraUi } from './ThreeCameraUi';
import { ThreeProjectilesLayer } from './ThreeProjectilesLayer';
import { ThreeVisualEffectsLayer } from './ThreeVisualEffectsLayer';

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

const initialCameraPosition = new Vector3(0, 0, CAMERA_HEIGHT);

const RenderGridHelper = () => (
  <group>
    <gridHelper
      position={[0, 0, 1]}
      args={[max_x - min_x, (max_x - min_x) / 10]}
      rotation={[Math.PI / 2, 0, 0]}
    />
    <gridHelper
      position={[0, 0, 2]}
      args={[max_x - min_x, (max_x - min_x) / 50, 'red', 'rgb(127,80,236)']}
      rotation={[Math.PI / 2, 0, 0]}
    />
    <group position={[10, 10, 10]}>
      <Text
        position={[0, 2, 0]}
        visible
        color="white"
        font="resources/fonts/DejaVuSans.ttf"
        fontSize={1.3}
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="center"
        anchorX="center"
        anchorY="bottom" // default
      >
        Coord 10/10
      </Text>
      <mesh>
        <circleBufferGeometry args={[1, 16]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
    <group position={[10, -10, 10]}>
      <Text
        position={[0, 2, 0]}
        visible
        color="white"
        fontSize={1.3}
        font="resources/fonts/DejaVuSans.ttf"
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="center"
        anchorX="center"
        anchorY="bottom" // default
      >
        Coord 10/-10
      </Text>
      <mesh>
        <circleBufferGeometry args={[1, 16]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
    <group position={[0, 0, 0]}>
      <Text
        position={[-5, 2, 0]}
        visible
        color="white"
        fontSize={1.3}
        font="resources/fonts/DejaVuSans.ttf"
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="center"
        anchorX="center"
        anchorY="bottom" // default
      >
        Coord 0/0
      </Text>
      <mesh>
        <circleBufferGeometry args={[1, 16]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
  </group>
);

export const ThreeLayer: React.FC<{
  visible: boolean;
  desiredMode: GameMode;
  cameraMinZoomShiftOverride?: number;
  cameraMaxZoomShiftOverride?: number;
  defaultShowGrid?: boolean;
}> = ({
  visible,
  desiredMode,
  cameraMinZoomShiftOverride,
  cameraMaxZoomShiftOverride,
  defaultShowGrid = false,
}) => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visMap, visualState, indexes } = ns;
  const [showGrid] = useToggleHotkey(
    'shift+g',
    defaultShowGrid,
    'show helper grid',
    undefined,
    'show grid'
  );
  useNSForceChange('ThreeLayer', true);

  const hoverOnGrabbable = useStore((state) => state.showTractorCircle);
  const overridenCameraRef = useRef();

  const shaderShift = seedToNumber(state.seed) % 1000;
  return (
    <Canvas
      className={classnames({ grabbable: hoverOnGrabbable })}
      orthographic
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
        <ThreeLoadingIndicator desiredMode={desiredMode} />
        <group
          visible={visible}
          onClick={(evt: ThreeEvent<MouseEvent>) => {
            const pos = threeVectorToVector(evt.point);
            const shipId = indexes.myShip?.id;
            if (shipId) {
              executeSyncAction(
                ActionBuilder.ActionNavigate({
                  target: Vector.fromIVector(pos),
                  ship_id: shipId,
                })
              );
            }
          }}
        >
          {/*background plane serves to be a click helper, as otherwise
          three will not register clicks (through empty space)*/}
          <OrthographicCamera
            makeDefault
            position={initialCameraPosition}
            zoom={CAMERA_DEFAULT_ZOOM()}
            far={1000}
            ref={overridenCameraRef}
          >
            <ThreeCameraUi />
            <ThreeSpaceBackground
              shaderShift={shaderShift}
              cameraPositionParallaxed
              size={getBackgroundSize()}
              cameraBound
            />
          </OrthographicCamera>
          {overridenCameraRef.current && (
            <CameraController
              overrideMin={cameraMinZoomShiftOverride}
              overrideMax={cameraMaxZoomShiftOverride}
            />
          )}
          <ambientLight />
          {showGrid && <RenderGridHelper />}
          <pointLight position={[0, 0, CAMERA_HEIGHT]} />
          <ThreeBodiesLayer
            state={state}
            visMap={visMap}
            visualState={visualState}
          />
          <ThreeShipsLayer state={state} visMap={visMap} indexes={indexes} />
          <ThreeProjectilesLayer
            state={state}
            visMap={visMap}
            indexes={indexes}
          />
          <ThreeQuestDirection state={state} visualState={visualState} />
          <ThreeNames netState={ns} visMap={visMap} />
          <ThreeWeaponEffectsLayer />
          <ThreeTrajectoryLayer indexes={indexes} />
          <ThreeBreadcrumbs
            breadcrumbs={visualState.breadcrumbs}
            currentTicks={state.ticks}
            displayForLastTicks={DISPLAY_BREADCRUMBS_LAST_TICKS}
          />
          {/*<ThreeWormhole position={posToThreePos(50, 50)} radius={3} />*/}
          <ThreeVisualEffectsLayer effects={state.locations[0].effects} />
        </group>
      </Suspense>
    </Canvas>
  );
};
