import React, { useRef } from 'react';
import { useLoader } from 'react-three-fiber';
import { Mesh, Geometry } from 'three';
import * as THREE from 'three';
import { ThreeRock } from './ThreeRock';
import { Vector3 } from 'three/src/math/Vector3';

const STLLoader = require('three-stl-loader')(THREE);

export const ThreeShip: React.FC<any> = (props) => {
  const mesh = useRef<Mesh>();
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/ship.stl');
  const color = props.color || 'white';

  return (
    <group>
      <mesh
        position={props.position}
        ref={mesh}
        scale={[0.3, 0.4, 0.5]}
        rotation={[Math.PI, 0, props.rotation]}
        geometry={shipModel}
      >
        <meshBasicMaterial color={color} />
        <ThreeRock position={new Vector3(10, 10, 0)} />
      </mesh>
    </group>
  );
};
