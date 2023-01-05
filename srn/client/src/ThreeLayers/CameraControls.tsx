import React, { useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useHotkeys } from 'react-hotkeys-hook';
import NetState, { VisualState } from '../NetState';
import { height_units, Ship, width_units } from '../world';
import { unitsToPixels_min } from '../coord';
import Vector, { IVector, VectorF } from '../utils/Vector';
import { MathUtils, Scene, ShaderMaterial, Vector3 } from 'three';
import _ from 'lodash';
import { threePosToVector, threeVectorToVector } from './util';
import { useScopedHotkey } from '../utils/hotkeyHooks';
import { SHIP_FIXED_Z } from './ShipShape';

export const CAMERA_HEIGHT = 100;
export const CAMERA_DEFAULT_ZOOM = () => unitsToPixels_min();
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_ZOOM_CHANGE_SPEED = 250 / 1000 / 1000;
export type CameraZoomerProps = {
  overrideMax?: number;
  overrideMin?: number;
};

export const getOnWheel = (
  visualState: VisualState,
  eventAdapter: (evt: any) => IVector,
  overrideMax?: number,
  overrideMin?: number
) => (evt: any) => {
  const adaptedEvent = eventAdapter(evt);
  if (_.isNaN(adaptedEvent)) {
    return;
  }
  const delta = adaptedEvent.y;
  visualState.targetZoomShift = visualState.targetZoomShift || 1.0;
  const deltaZoom = delta * CAMERA_ZOOM_CHANGE_SPEED;
  visualState.targetZoomShift -= deltaZoom;
  visualState.targetZoomShift = Math.min(
    visualState.targetZoomShift,
    overrideMax || CAMERA_MAX_ZOOM
  );
  visualState.targetZoomShift = Math.max(
    visualState.targetZoomShift,
    overrideMin || CAMERA_MIN_ZOOM
  );
};

export const CameraController: React.FC<CameraZoomerProps> = ({
  overrideMin,
  overrideMax,
}) => {
  const ns = NetState.get();
  if (!ns) return null;

  const { visualState, indexes } = ns;

  const { camera, scene } = useThree();

  const syncDataToCamera = () => {
    visualState.cameraPosition.x = camera.position.x;
    visualState.cameraPosition.y = -camera.position.y;
    visualState.currentZoomShift = camera.zoom / CAMERA_DEFAULT_ZOOM();
  };

  useScopedHotkey(
    'c',
    () => {
      visualState.targetZoomShift = 1.0;
      visualState.boundCameraMovement = !visualState.boundCameraMovement;
    },
    'game',
    {},
    [ns]
  );

  const forceMoveCameraToShip = (
    elapsedTicks: number,
    gameScene: Scene,
    shipOverride?: Ship
  ) => {
    const targetShipId = shipOverride ? shipOverride.id : indexes.myShip?.id;
    const myShipMesh = targetShipId
      ? gameScene.getObjectByName(`ship-${targetShipId}`)
      : null;
    if (!myShipMesh) {
      return;
    }
    const tmp = new Vector3();
    myShipMesh.getWorldPosition(tmp);
    tmp.z = CAMERA_HEIGHT;
    const dist = camera.position.distanceTo(tmp);
    if (dist > 0.01) {
      camera.position.lerp(tmp, 0.99);
    }
  };

  useEffect(() => {
    ns.on('gameEvent', (ev: any) => {
      if (ev.ShipSpawned && ev.ShipSpawned.player.id === ns.state.my_id) {
        forceMoveCameraToShip(0, scene, ev.ShipSpawned.ship);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns.id]);
  useFrame(({ scene }, delta) => {
    if (visualState.boundCameraMovement) {
      forceMoveCameraToShip(delta, scene);
    } else if (visualState.forcedCameraPosition) {
      camera.position.set(
        visualState.forcedCameraPosition.x,
        -visualState.forcedCameraPosition.y,
        CAMERA_HEIGHT
      );
      visualState.forcedCameraPosition = undefined;
    }
    syncDataToCamera();
    camera.zoom = MathUtils.lerp(
      camera.zoom,
      visualState.targetZoomShift * CAMERA_DEFAULT_ZOOM(),
      0.1
    );
  });
  return (
    <group
      onWheel={getOnWheel(
        visualState,
        (evt) => ({
          y: evt.deltaY,
          x: evt.deltaX,
        }),
        overrideMax,
        overrideMin
      )}
    >
      <mesh position={[0, 0, -20]}>
        <planeBufferGeometry args={[width_units, height_units]} />
        <meshBasicMaterial transparent color="green" />
      </mesh>
    </group>
  );
};

// export const ExternalCameraControl: React.FC = () => {
//   const ns = NetState.get();
//   if (!ns) return null;
//   const { visualState } = ns;
//   const { camera } = useThree();
//   if (!visualState.boundCameraMovement) {
//     // manual camera movement, e.g. by Minimap
//     camera.position.set(
//       visualState.cameraPosition.x,
//       -visualState.cameraPosition.y,
//       CAMERA_HEIGHT
//     );
//   }
//   if (visualState.zoomShift) {
//     const oldZoom = camera.zoom;
//     const newZoom = visualState.zoomShift * CAMERA_DEFAULT_ZOOM();
//     if (oldZoom !== newZoom) {
//       // override smooth transition of camera
//       console.log(Vector.fromIVector(visualState.cameraPosition));
//       camera.position.set(
//         visualState.cameraPosition.x,
//         -visualState.cameraPosition.y,
//         CAMERA_HEIGHT
//       );
//       camera.zoom = newZoom;
//       camera.updateProjectionMatrix();
//     }
//   }
//
//   return null;
// };
