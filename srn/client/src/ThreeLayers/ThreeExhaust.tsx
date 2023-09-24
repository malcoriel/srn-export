import React, { useEffect, useMemo, useRef } from 'react';
import { fragmentShader, vertexShader, uniforms } from './shaders/exhaust';
import { useFrame } from '@react-three/fiber';
import { Mesh, RawShaderMaterial, Vector3 } from 'three';
import { vecToThreePos } from './util';
import Vector, { IVector, VectorF } from '../utils/Vector';
import Color from 'color';
import _ from 'lodash';
import { useFadingMaterial } from './UseFadingMaterial';

const INTENSITY_ANIMATION_PER_FRAME = 0.05;

export type ThreeExhaustProps = {
  position: IVector;
  radius: number;
  rotation: number;
  intensity?: number;
  useIntensity?: boolean;
  color: string;
  speedUp?: boolean;
  inverse?: boolean;
  fadeOver?: number;
};
export const ThreeExhaustImpl: React.FC<ThreeExhaustProps> = ({
  position,
  radius,
  rotation,
  intensity,
  color,
  fadeOver,
  speedUp,
  useIntensity,
  inverse,
}) => {
  const materialRef1 = useFadingMaterial(fadeOver);
  const meshRef = useRef<Mesh>();
  useFrame(() => {
    if (meshRef && meshRef.current) {
      const shaderMat = meshRef.current.material as RawShaderMaterial;
      if (shaderMat && shaderMat.uniforms && shaderMat.uniforms.iTime) {
        // since inverse flag may suddenly disappear,
        // and we need to animate, we need to remember its last value
        meshRef.current.userData.inversing =
          meshRef.current.userData.inversing || inverse;
        shaderMat.uniforms.inverse.value = meshRef.current.userData.inversing
          ? 1.0
          : 0.0;
        shaderMat.uniforms.iTime.value += 0.1;
        if (!useIntensity) {
          const defaultValue = speedUp ? 0.0 : 1.0;
          meshRef.current.userData.speedUpCounter =
            typeof meshRef.current.userData.speedUpCounter === 'undefined'
              ? defaultValue
              : meshRef.current.userData.speedUpCounter;
          if (speedUp) {
            meshRef.current.userData.speedUpCounter += INTENSITY_ANIMATION_PER_FRAME;
          } else {
            meshRef.current.userData.speedUpCounter -= INTENSITY_ANIMATION_PER_FRAME;
          }
          if (meshRef.current.userData.speedUpCounter > 1.0) {
            meshRef.current.userData.speedUpCounter = 1.0;
          } else if (meshRef.current.userData.speedUpCounter < 0.0) {
            meshRef.current.userData.speedUpCounter = 0.0;
          }
          shaderMat.uniforms.intensity.value =
            meshRef.current.userData.speedUpCounter;
          // reset remembered value when it's guaranteed to be invisible
          if (shaderMat.uniforms.intensity.value < 1e-6) {
            meshRef.current.userData.inversing = false;
          }
        } else {
          shaderMat.uniforms.intensity.value =
            typeof intensity !== 'number' ? 0.0 : intensity;
        }
      }
    }
  });
  const usedUniforms = useMemo(() => {
    const initialClone = _.cloneDeep(uniforms);
    const numbers = new Color(color).unitArray();
    initialClone.mainColor.value = new Vector3(...numbers);
    return initialClone;
  }, [color]);
  return (
    <group
      position={vecToThreePos(VectorF(position.x, position.y))}
      rotation={[0, 0, (rotation || 0.0) - Math.PI / 2]}
    >
      <mesh ref={meshRef} position={[0, -radius / 4, 0]}>
        <planeBufferGeometry args={[radius / 2, radius / 2]} />
        <rawShaderMaterial
          ref={materialRef1}
          transparent
          fragmentShader={fragmentShader}
          vertexShader={vertexShader}
          uniforms={usedUniforms}
        />
      </mesh>
    </group>
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

export const ThreeExhaust = React.memo(
  ThreeExhaustImpl,
  (prevProps, nextProps) => {
    return (
      prevProps.speedUp === nextProps.speedUp &&
      Vector.equals(prevProps.position, nextProps.position) &&
      prevProps.rotation === nextProps.rotation
    );
  }
);
