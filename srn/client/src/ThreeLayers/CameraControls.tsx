import React, { useEffect } from 'react';
import NetState, { findMyShip } from '../NetState';
import { useThree } from 'react-three-fiber';
import { height_units, Ship, width_units } from '../world';
import { useHotkeys } from 'react-hotkeys-hook';
import { unitsToPixels_min } from '../coord';

export const BoundCameraMover: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { state, visualState } = ns;

  const { camera } = useThree();

  const forceMoveCameraToShip = (shipOverride?: Ship) => {
    const myShip = shipOverride || findMyShip(state);
    if (myShip) {
      visualState.cameraPosition = { x: myShip.x, y: myShip.y };
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

  if (visualState.boundCameraMovement) {
    forceMoveCameraToShip();
  }

  return null;
};
export const CAMERA_HEIGHT = 100;
export const CAMERA_DEFAULT_ZOOM = () => unitsToPixels_min();
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_MIN_ZOOM = 0.5;
export const CAMERA_ZOOM_CHANGE_SPEED = 1 / 1000;

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
    let oldZoom = camera.zoom;
    let newZoom = visualState.zoomShift * CAMERA_DEFAULT_ZOOM();
    camera.zoom = newZoom;
    if (oldZoom !== newZoom) camera.updateProjectionMatrix();
  }

  return null;
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
      onWheel={(evt: any) => {
        const delta = evt.deltaY;
        visualState.zoomShift = visualState.zoomShift || 1.0;
        let deltaZoom = delta * CAMERA_ZOOM_CHANGE_SPEED;
        visualState.zoomShift -= deltaZoom;
        visualState.zoomShift = Math.min(
          visualState.zoomShift,
          CAMERA_MAX_ZOOM
        );
        visualState.zoomShift = Math.max(
          visualState.zoomShift,
          CAMERA_MIN_ZOOM
        );
      }}
    >
      <mesh position={[0, 0, -20]}>
        <planeBufferGeometry args={[width_units, height_units]} />
        <meshBasicMaterial transparent={true} color="green" />
      </mesh>
    </group>
  );
};
