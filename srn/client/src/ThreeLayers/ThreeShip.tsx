import React, { useRef } from 'react';
import { useFrame, useLoader } from 'react-three-fiber';
import { Mesh, Geometry, FontLoader, Font } from 'three';
import * as THREE from 'three';

const STLLoader = require('three-stl-loader')(THREE);

export const ThreeShip: React.FC<any> = (props) => {
  const mesh = useRef<Mesh>();
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/ship.stl');
  const color = props.color || 'white';

  useFrame(() => {
    // if (mesh.current) mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
  });

  return (
    <mesh
      position={props.position}
      ref={mesh}
      scale={[0.3, 0.4, 0.5]}
      rotation={[Math.PI, 0, 0]}
      geometry={shipModel}
    >
      <meshBasicMaterial color={color} />
    </mesh>
  );
};
