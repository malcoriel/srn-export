import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh, Geometry, FontLoader, Font } from 'three';
import * as THREE from 'three';
import { Ship, unitsToPixels } from '../world';

const STLLoader = require('three-stl-loader')(THREE);

export const ShipS: React.FC<any> = (props) => {
  const mesh = useRef<Mesh>();
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/ship.stl');
  const font = useLoader<Font>(FontLoader, 'resources/roboto.json');
  const color = props.color || 'white';

  useFrame(() => {
    // if (mesh.current) mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
  });

  return (
    <group position={props.position}>
      <mesh
        rotation={[Math.PI / 2, Math.PI, Math.PI]}
        scale={[1, 1, 0.01]}
        position={[0, -20, 0]}
      >
        <textGeometry args={[props.name, { font, size: 2 }]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh
        ref={mesh}
        scale={[0.35, 0.5, 0.5]}
        rotation={[Math.PI / 2, Math.PI, 0]}
        geometry={shipModel}
      >
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};
