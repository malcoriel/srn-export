// @ts-ignore
import React, { useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { fragmentShader, vertexShader, uniforms } from './shaders/lensing';
import { useFrame } from '@react-three/fiber';
import { Mesh, RawShaderMaterial } from 'three';
import { Vector3Arr } from './util';

export const ThreeWormhole: React.FC<{
  position: Vector3 | Vector3Arr;
  radius: number;
  scale: number;
}> = ({ position, radius, scale }) => {
  const meshRef = useRef<Mesh>();
  useFrame(() => {
    if (meshRef && meshRef.current) {
      const shaderMat = meshRef.current.material as RawShaderMaterial;
      if (shaderMat && shaderMat.uniforms && shaderMat.uniforms.iTime) {
        shaderMat.uniforms.iTime.value += 0.1;
      }
    }
  });
  const uniforms2 = useMemo(() => uniforms, []);
  const vecScale = useMemo(() => new Vector3(scale, scale, scale), [scale]);

  return (
    <mesh scale={vecScale} position={position} ref={meshRef}>
      <circleBufferGeometry args={[radius, 64]} />
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
    </mesh>
  );

  // return (
  //   <mesh position={position} ref={meshRef}>
  //     <circleBufferGeometry args={[radius, 64]} />
  // <rawShaderMaterial
  //   transparent
  //   fragmentShader={fragmentShader}
  //   vertexShader={vertexShader}
  //   uniforms={uniforms2}
  // />;
  //   </mesh>
  // );
};
