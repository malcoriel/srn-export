import React from 'react';
import './CameraCoordinatesBox.scss';
import { useNSForceChange } from '../NetStateHooks';
import Vector from '../utils/Vector';
import { getSrnState } from '../store';

const trimMax = (velValue: number) => {
  return velValue <= 100.0 ? velValue.toFixed(2) : '100+';
};

export const CameraCoordinatesBox: React.FC = () => {
  const ns = useNSForceChange('CameraCoordinatesBox', false);
  if (!ns) {
    return null;
  }

  const showingGrid = getSrnState().hotkeysPressed['show grid'];
  if (!showingGrid) {
    return null;
  }

  const myShip = ns.indexes.myShip;
  let line = '';
  if (myShip) {
    line += `v=${trimMax(
      Vector.fromIVector(myShip.spatial.velocity).length() * 1000 * 1000
    )} `;
    line += `av=${trimMax(myShip.spatial.angular_velocity * 1000 * 1000)} `;
  }
  line += `c=${Vector.fromIVector(ns.visualState.cameraPosition).toKey(
    '/',
    2
  )}`;
  line += ` x${ns.visualState.currentZoomShift.toFixed(2)} `;
  if (ns.visualState.boundCameraMovement) line += '!';
  return (
    <div className="coordinate-box">
      <div>{line}</div>
    </div>
  );
};
