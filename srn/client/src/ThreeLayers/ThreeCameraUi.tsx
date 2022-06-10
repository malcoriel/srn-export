import React from 'react';
import { Html } from '@react-three/drei';
import { Camera, Object3D } from 'three';

export const ThreeCameraUi: React.FC = () => {
  return (
    <Html
      rotation={[0, 0, Math.PI]}
      calculatePosition={(
        _el: Object3D,
        _camera: Camera,
        size: { width: number; height: number }
      ) => {
        return [size.width - 10, size.height - 10, 0];
      }}
    >
      <div
        style={{
          backgroundColor: 'red',
          color: 'white',
          pointerEvents: 'none',
        }}
      >
        123123
      </div>
    </Html>
  );
};
