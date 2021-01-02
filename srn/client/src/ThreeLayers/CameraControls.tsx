import React from 'react';
import NetState, { findMyShip } from '../NetState';
import { useThree } from 'react-three-fiber';
import { height_units, unitsToPixels, width_units } from '../world';

export const BoundCameraMover: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { state, visualState } = ns;

  if (visualState.boundCameraMovement) {
    const myShip = findMyShip(state);
    const { camera } = useThree();
    if (myShip) {
      visualState.cameraPosition = { x: myShip.x, y: myShip.y };
    }

    camera.position.set(
      visualState.cameraPosition.x,
      -visualState.cameraPosition.y,
      CAMERA_HEIGHT
    );
  }

  return null;
};
export const CAMERA_HEIGHT = 100;
export const CAMERA_DEFAULT_ZOOM = unitsToPixels;
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
    camera.zoom = visualState.zoomShift * CAMERA_DEFAULT_ZOOM;
  }

  return null;
};

export const CameraZoomer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { visualState } = ns;
  const { camera } = useThree();
  return (
    <group
      onWheel={(evt: any) => {
        const delta = evt.deltaY;
        console.log({ delta });
      }}
    >
      <mesh position={[0, 0, -20]}>
        <planeBufferGeometry args={[width_units, height_units]} />
      </mesh>
    </group>
  );
};
