import React, { useMemo, useRef } from 'react';
import { useFrame, useLoader } from 'react-three-fiber';
import { Mesh, Geometry, ShaderMaterial } from 'three';
import * as THREE from 'three';
import Vector, { VectorF } from '../utils/Vector';
import { posToThreePos, vecToThreePos } from './ThreeLayer';
import * as electric from './shaders/electric';

const STLLoader = require('three-stl-loader')(THREE);

type ThreeShipProps = {
  position: Vector;
  tractorTargetPosition?: Vector;
  color: string;
  rotation: number;
};

export const ThreeShip: React.FC<ThreeShipProps> = ({
  tractorTargetPosition,
  position,
  rotation,
  color,
}) => {
  const tractorRef = useRef<Mesh>();
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/ship.stl');

  const tractorBeamParams = useMemo(() => {
    if (!tractorTargetPosition) {
      return null;
    }
    const vector = tractorTargetPosition.subtract(position);
    let angle = VectorF(0, 1).angleRad(vector);
    return {
      length: vector.length(),
      rotation: vector.x < 0 ? angle : -angle,
      position: vecToThreePos(vector.scale(0.5)),
    };
  }, [tractorTargetPosition, position]);

  useFrame(() => {
    if (tractorRef.current) {
      let material = tractorRef.current.material as ShaderMaterial;
      if (material && material.uniforms) {
        material.uniforms.time.value += 0.002;
      }
    }
  });

  return (
    <group position={posToThreePos(position.x, position.y)}>
      <mesh
        position={[0, 0, 0]}
        ref={tractorRef}
        scale={[0.3, 0.4, 0.5]}
        rotation={[Math.PI, 0, rotation]}
        geometry={shipModel}
      >
        <meshBasicMaterial color={color} />
      </mesh>
      {true && (
        <mesh
          ref={tractorRef}
          position={[0, 0, 20]}
          // position={tractorBeamParams.position}
          // rotation={[0, 0, -tractorBeamParams.rotation]}
        >
          <cylinderBufferGeometry args={[3, 3, 20, 4]} />
          <rawShaderMaterial transparent={true} {...electric} />
        </mesh>
      )}
    </group>
  );
};
