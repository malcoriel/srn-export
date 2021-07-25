// @ts-ignore
import React, { useMemo, useRef } from 'react';
import { Vector3 } from 'three/src/math/Vector3';
import { fragmentShader, vertexShader, uniforms } from './shaders/lensing';
import { useFrame } from '@react-three/fiber';
import { Mesh, RawShaderMaterial } from 'three';
import { Vector3Arr } from './ThreeLayer';
import { useSpring, animated } from '@react-spring/three';

export const ThreeWormhole: React.FC<{
  position: Vector3 | Vector3Arr;
  radius: number;
  opening?: boolean;
  closing?: boolean;
}> = ({ position, radius, opening }) => {
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
  const { scale } = useSpring({ scale: opening ? 1.5 : 1 });

  return (
    <animated.mesh position={position} ref={meshRef}>
      <circleBufferGeometry args={[radius, 64]} />
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
    </animated.mesh>
  );
};
