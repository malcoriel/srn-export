import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useHotkeys } from 'react-hotkeys-hook';
import NetState, { VisualState } from '../NetState';
import { height_units, Ship, width_units } from '../world';
import { unitsToPixels_min } from '../coord';
import Vector, { IVector, VectorF } from '../utils/Vector';
import { Scene, ShaderMaterial, Vector3 } from 'three';
import _ from 'lodash';
import { threePosToVector, threeVectorToVector } from './util';

export const CAMERA_HEIGHT = 100;
export const CAMERA_DEFAULT_ZOOM = () => unitsToPixels_min();
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_ZOOM_CHANGE_SPEED = 1 / 1000;
const CAMERA_MOVEMENT_PER_TICK = 50; // camera animation speed
const CAMERA_SETTLE_DIST = 0.5;
export const BoundCameraMover: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { visualState, indexes } = ns;

  const { camera, scene } = useThree();

  const syncCameraToData = () => {
    visualState.cameraPosition.x = camera.position.x;
    visualState.cameraPosition.y = -camera.position.y;
  };

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
    camera.position.lerp(tmp, 0.2);
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
    }
    syncCameraToData();
  });
  return null;
};

export const ExternalCameraControl: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { visualState } = ns;
  const { camera } = useThree();
  if (!visualState.boundCameraMovement) {
    camera.position.set(
      visualState.cameraPosition.x,
      -visualState.cameraPosition.y,
      CAMERA_HEIGHT
    );
  }
  if (visualState.zoomShift) {
    const oldZoom = camera.zoom;
    const newZoom = visualState.zoomShift * CAMERA_DEFAULT_ZOOM();
    camera.zoom = newZoom;
    if (oldZoom !== newZoom) {
      camera.updateProjectionMatrix();
      // override smooth transition of camera
      camera.position.set(
        visualState.cameraPosition.x,
        -visualState.cameraPosition.y,
        CAMERA_HEIGHT
      );
    }
  }

  return null;
};

export const getOnWheel = (
  visualState: VisualState,
  eventAdapter: (evt: any) => IVector,
  overrideMax?: number,
  overrideMin?: number
) => (evt: any) => {
  const adaptedEvent = eventAdapter(evt);
  const delta = adaptedEvent.y;
  visualState.zoomShift = visualState.zoomShift || 1.0;
  const deltaZoom = delta * CAMERA_ZOOM_CHANGE_SPEED;
  visualState.zoomShift -= deltaZoom;
  visualState.zoomShift = Math.min(
    visualState.zoomShift,
    overrideMax || CAMERA_MAX_ZOOM
  );
  visualState.zoomShift = Math.max(
    visualState.zoomShift,
    overrideMin || CAMERA_MIN_ZOOM
  );
};

export type CameraZoomerProps = {
  overrideMax?: number;
  overrideMin?: number;
};

export const CameraZoomer: React.FC<CameraZoomerProps> = ({
  overrideMax,
  overrideMin,
}) => {
  const ns = NetState.get();
  if (!ns) return null;
  const { visualState } = ns;
  useHotkeys('c', () => {
    visualState.zoomShift = 1.0;
    visualState.boundCameraMovement = true;
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
