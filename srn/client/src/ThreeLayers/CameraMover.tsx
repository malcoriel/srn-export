import React from 'react';
import NetState, { findMyShip } from '../NetState';
import { useThree } from 'react-three-fiber';
import { CAMERA_HEIGHT } from './ThreeLayer';

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

  return null;
};
