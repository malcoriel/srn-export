import React from 'react';
import './CameraCoordinatesBox.scss';
import { useNSForceChange } from '../NetStateHooks';
import Vector from '../utils/Vector';

export const CameraCoordinatesBox: React.FC = () => {
  const ns = useNSForceChange('CameraCoordinatesBox', false);
  if (!ns) {
    return null;
  }
  const line = Vector.fromIVector(ns.visualState.cameraPosition).toKey('/', 2);
  return (
    <div className="coordinate-box">
      <div>{line}</div>
    </div>
  );
};
