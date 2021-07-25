// @ts-ignore
import React, { useMemo, useRef } from 'react';
import { Vector3 } from 'three/src/math/Vector3';
import { fragmentShader, vertexShader, uniforms } from './shaders/lensing';
import { useFrame } from 'react-three-fiber';
import { RawShaderMaterial } from 'three';

export const ThreeWormhole: React.FC<{ position: Vector3; radius: number }> = ({
  position,
  radius,
}) => {
  const meshRef = useRef(null);
  useFrame(() => {
    if (meshRef.current) {
      const shaderMat = meshRef.current.material as RawShaderMaterial;
      if (shaderMat && shaderMat.uniforms && shaderMat.uniforms.iTime) {
        shaderMat.uniforms.iTime.value += 0.1;
      }
    }
  });
  const uniforms2 = useMemo(() => uniforms, []);

  return (
    <mesh position={position} ref={meshRef}>
      <circleBufferGeometry args={[radius, 64]} />
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
    </mesh>
  );
};
