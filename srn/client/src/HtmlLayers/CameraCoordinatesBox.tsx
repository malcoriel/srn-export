import React from 'react';
import './CameraCoordinatesBox.scss';
import { useNSForceChange } from '../NetStateHooks';
import Vector from '../utils/Vector';

export const CameraCoordinatesBox: React.FC = () => {
  const ns = useNSForceChange('CameraCoordinatesBox', false);
  if (!ns) {
    return null;
  }
  let line: string = Vector.fromIVector(ns.visualState.cameraPosition).toKey(
    '/',
    2
  );
  line += ` x${ns.visualState.currentZoomShift.toFixed(2)} `;
  if (ns.visualState.boundCameraMovement) line += '!';
  return (
    <div className="coordinate-box">
      <div>{line}</div>
    </div>
  );
};
