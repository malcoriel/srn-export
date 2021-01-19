import React, { useRef } from 'react';
import { useLoader } from 'react-three-fiber';
import { Mesh, Geometry } from 'three';
import * as THREE from 'three';
import { ThreeRock } from './ThreeRock';
import { ThreeAsteroidBelt } from './ThreeAsteroidBelt';

const STLLoader = require('three-stl-loader')(THREE);

export const ThreeShip: React.FC<any> = (props) => {
  const mesh = useRef<Mesh>();
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/ship.stl');
  const color = props.color || 'white';

  return (
    <group position={props.position}>
      <mesh
        position={[0, 0, 0]}
        ref={mesh}
        scale={[0.3, 0.4, 0.5]}
        rotation={[Math.PI, 0, props.rotation]}
        geometry={shipModel}
      >
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};
