import React, { useRef } from 'react';
import { fragmentShader, uniforms, vertexShader } from '../shaders/explosion';
import { Mesh, ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import _ from 'lodash';

type ExplosionProps = {
  foo: string;
};

const usedUniforms = _.cloneDeep(uniforms);
usedUniforms.compressX.value = 1.0;

export const ThreeExplosion: React.FC<ExplosionProps> = () => {
  const mesh = useRef<Mesh>();

  useFrame(() => {
    if (mesh.current) {
      const material = mesh.current.material as ShaderMaterial;
      material.uniforms.time.value += 0.01;
      // mesh.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={mesh}>
      <planeBufferGeometry args={[200, 200]} />
      {/*<sphereBufferGeometry args={[100, 256, 256]} />*/}
      <meshBasicMaterial color="black" />
      <rawShaderMaterial
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={usedUniforms}
        transparent
      />
    </mesh>
  );
};

export const BackgroundPlane = () => {};
