import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh, Geometry } from 'three';
import * as THREE from 'three';

const STLLoader = require('three-stl-loader')(THREE);

export const ShipS: React.FC<MeshProps & { color?: string }> = (props) => {
  const mesh = useRef<Mesh>();
  const shipModel: Geometry = useLoader(STLLoader, 'resources/ship.stl');
  const color = props.color || 'white';

  useFrame(() => {
    // if (mesh.current) mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
  });

  return (
    <mesh
      {...props}
      ref={mesh}
      scale={[0.5, 0.5, 0.5]}
      rotation={[Math.PI / 2, Math.PI, 0]}
      geometry={shipModel}
    >
      <meshBasicMaterial color={color} />
    </mesh>
  );
};
