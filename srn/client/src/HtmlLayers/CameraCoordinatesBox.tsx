import React from 'react';
import './CameraCoordinatesBox.scss';
import { useNSForceChange } from '../NetStateHooks';
import Vector from '../utils/Vector';

export const CameraCoordinatesBox: React.FC = () => {
  const ns = useNSForceChange('CameraCoordinatesBox', false);
  if (!ns) {
    return null;
  }
  const myShip = ns.indexes.myShip;
  let line = '';
  if (myShip) {
    if (myShip.movement_definition.tag === 'ShipAccelerated') {
      line += `s=${(
        myShip.movement_definition.current_linear_speed *
        1000 *
        1000
      ).toFixed(2)} `;
    }
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
