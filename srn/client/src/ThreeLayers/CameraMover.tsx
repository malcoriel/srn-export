import React from 'react';
import NetState, { findMyShip } from '../NetState';
import { useThree } from 'react-three-fiber';
import { CAMERA_HEIGHT } from './ThreeLayer';

export const ShipPositionToCameraSyncer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { state } = ns;
  const myShip = findMyShip(state);

  if (myShip) {
    const pos = { x: myShip.x, y: myShip.y };
    ns.visualState.cameraPosition = pos;
  }
  return null;
};

export const CameraReceiver: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { visualState } = ns;

  const { camera } = useThree();
  camera.position.set(
    visualState.cameraPosition.x,
    -visualState.cameraPosition.y,
    CAMERA_HEIGHT
  );
  return null;
};
