import React from 'react';
import NetState, { findMyShip } from '../NetState';
import { useThree } from 'react-three-fiber';
import { CAMERA_HEIGHT } from './ThreeLayer';

export const CameraMover: React.FC = () => {
  const { state } = NetState.get();
  const myShip = findMyShip(state);
  const { camera } = useThree();

  if (myShip) {
    const pos = { x: myShip.x, y: myShip.y };
    camera.position.set(pos.x, -pos.y, CAMERA_HEIGHT);
    NetState.get().visualState.cameraPosition = pos;
  }
  return null;
};
