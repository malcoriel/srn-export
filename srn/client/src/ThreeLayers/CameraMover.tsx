import React from 'react';
import { GameState } from '../world';
import { IVector } from '../utils/Vector';
import { findMyShip } from '../NetState';
import { useThree } from 'react-three-fiber';
import { CAMERA_HEIGHT } from './ThreeLayer';

export const CameraMover: React.FC<{
  state: GameState;
  onChangeCamera: (position: IVector) => void;
}> = ({ state, onChangeCamera }) => {
  const myShip = findMyShip(state);
  const { camera } = useThree();

  if (myShip) {
    const pos = { x: myShip.x, y: myShip.y };
    camera.position.set(pos.x, -pos.y, CAMERA_HEIGHT);
    onChangeCamera(pos);
  }
  return null;
};
