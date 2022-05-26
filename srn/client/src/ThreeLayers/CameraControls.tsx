import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useHotkeys } from 'react-hotkeys-hook';
import NetState, { VisualState } from '../NetState';
import { height_units, Ship, width_units } from '../world';
import { unitsToPixels_min } from '../coord';
import { IVector } from '../utils/Vector';
import { ShaderMaterial } from 'three';

export const CAMERA_HEIGHT = 100;
export const CAMERA_DEFAULT_ZOOM = () => unitsToPixels_min();
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_ZOOM_CHANGE_SPEED = 1 / 1000;
export const BoundCameraMover: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { visualState, indexes } = ns;

  const { camera } = useThree();
  const forceMoveCameraToShip = (shipOverride?: Ship) => {
    const myShipPos = shipOverride
      ? { x: shipOverride.x, y: shipOverride.y }
      : indexes.myShipPosition;
    if (myShipPos) {
      visualState.cameraPosition = { x: myShipPos.x, y: myShipPos.y };
    }
    camera.position.set(
      visualState.cameraPosition.x,
      -visualState.cameraPosition.y,
      CAMERA_HEIGHT
    );
  };

  useEffect(() => {
    ns.on('gameEvent', (ev: any) => {
      if (ev.ShipSpawned && ev.ShipSpawned.player.id === ns.state.my_id) {
        forceMoveCameraToShip(ev.ShipSpawned.ship);
      }
    });
  }, [ns.id]);
  useFrame(() => {
    if (visualState.boundCameraMovement) {
      forceMoveCameraToShip();
    }
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
    if (oldZoom !== newZoom) camera.updateProjectionMatrix();
  }

  return null;
};

export const getOnWheel = (
  visualState: VisualState,
  eventAdapter: (evt: any) => IVector
) => (evt: any) => {
  const delta = eventAdapter(evt).y;
  visualState.zoomShift = visualState.zoomShift || 1.0;
  const deltaZoom = delta * CAMERA_ZOOM_CHANGE_SPEED;
  visualState.zoomShift -= deltaZoom;
  visualState.zoomShift = Math.min(visualState.zoomShift, CAMERA_MAX_ZOOM);
  visualState.zoomShift = Math.max(visualState.zoomShift, CAMERA_MIN_ZOOM);
};

export const CameraZoomer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { visualState } = ns;
  useHotkeys('c', () => {
    visualState.zoomShift = 1.0;
    visualState.boundCameraMovement = true;
  });
  return (
    <group
      onWheel={getOnWheel(visualState, (evt) => ({
        y: evt.deltaY,
        x: evt.deltaX,
      }))}
    >
      <mesh position={[0, 0, -20]}>
        <planeBufferGeometry args={[width_units, height_units]} />
        <meshBasicMaterial transparent color="green" />
      </mesh>
    </group>
  );
};
