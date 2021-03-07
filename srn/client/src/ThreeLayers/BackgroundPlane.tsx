import React, { useRef } from 'react';
import { useFrame } from 'react-three-fiber';
import { Mesh, ShaderMaterial } from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/starfield';
import { height_units, width_units } from '../world';

export const BackgroundPlane = () => {
  const mesh = useRef<Mesh>();

  useFrame(() => {
    if (mesh.current) {
      const material = mesh.current.material as ShaderMaterial;
      material.uniforms.time.value += 0.01;
    }
  });

  return (
    <mesh position={[0, 0, -10]} ref={mesh}>
      <planeBufferGeometry args={[width_units * 1.5, height_units * 1.5]} />
      <meshBasicMaterial color="black" />
      <rawShaderMaterial
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms}
        extensions={{
          derivatives: true,
          fragDepth: true,
          drawBuffers: true,
          shaderTextureLOD: true,
        }}
      />
    </mesh>
  );
};
