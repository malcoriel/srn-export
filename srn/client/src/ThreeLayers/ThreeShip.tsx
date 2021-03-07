import React, { useMemo, useRef } from 'react';
import { useFrame, useLoader } from 'react-three-fiber';
import { Mesh, Geometry, ShaderMaterial } from 'three';
import * as THREE from 'three';
import Vector, { VectorF } from '../utils/Vector';
import { posToThreePos, vecToThreePos } from './ThreeLayer';
import * as jellyfish from './shaders/jellyfish';
import { shallowEqual } from '../utils/shallowCompare';

const STLLoader = require('three-stl-loader')(THREE);

type ThreeShipProps = {
  position: Vector;
  tractorTargetPosition?: Vector;
  color: string;
  rotation: number;
  visible: boolean;
};

const BEAM_WIDTH = 0.3;

export const ThreeShip: React.FC<ThreeShipProps> = React.memo(
  ({ tractorTargetPosition, position, rotation, color, visible }) => {
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
        patchedUniforms: {
          ...jellyfish.uniforms,
        },
      };
    }, [tractorTargetPosition, position]);

    useFrame(() => {
      if (tractorRef.current && visible) {
        let material = tractorRef.current.material as ShaderMaterial;
        if (material && material.uniforms) {
          material.uniforms.time.value += 0.004;
        }
      }
    });

    return (
      <group position={posToThreePos(position.x, position.y, 50)}>
        <mesh
          position={[0, 0, 0]}
          ref={tractorRef}
          scale={[0.3, 0.4, 0.5]}
          rotation={[Math.PI, 0, rotation]}
          geometry={shipModel}
        >
          <meshBasicMaterial color={color} />
        </mesh>
        {tractorBeamParams && (
          <mesh
            ref={tractorRef}
            position={tractorBeamParams.position}
            rotation={[0, 0, -tractorBeamParams.rotation]}
          >
            <cylinderBufferGeometry
              args={[BEAM_WIDTH, BEAM_WIDTH, tractorBeamParams.length, 4]}
            />
            <rawShaderMaterial
              transparent={true}
              {...jellyfish}
              // uniforms={tractorBeamParams.patchedUniforms}
            />
          </mesh>
        )}
      </group>
    );
  },
  (prevProps, nextProps) => {
    if (!nextProps.visible) {
      return true;
    }
    return shallowEqual(prevProps, nextProps);
  }
);
