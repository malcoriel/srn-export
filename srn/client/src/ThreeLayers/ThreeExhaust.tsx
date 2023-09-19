import React, { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { fragmentShader, vertexShader, uniforms } from './shaders/exhaust';
import { useFrame } from '@react-three/fiber';
import { Mesh, RawShaderMaterial } from 'three';
import { Vector3Arr } from './util';

export type ThreeExhaustProps = {
  position: Vector3 | Vector3Arr;
  radius: number;
  rotation: number;
};
export const ThreeExhaust: React.FC<ThreeExhaustProps> = ({
  position,
  radius,
  rotation,
}) => {
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
  return (
    <mesh position={position} ref={meshRef} rotation={[0, 0, rotation || 0.0]}>
      <planeBufferGeometry args={[radius, radius]} />
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
