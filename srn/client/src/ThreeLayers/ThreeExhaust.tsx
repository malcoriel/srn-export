import React, { useMemo, useRef } from 'react';
import { fragmentShader, vertexShader, uniforms } from './shaders/exhaust';
import { useFrame } from '@react-three/fiber';
import { Mesh, RawShaderMaterial, Vector3 } from 'three';
import { vecToThreePos } from './util';
import { IVector, VectorF } from '../utils/Vector';
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
export const ThreeExhaust: React.FC<ThreeExhaustProps> = ({
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
        }
      }
    }
  });
  const uniforms2 = useMemo(() => {
    const patchedUniforms = _.cloneDeep(uniforms);
    if (useIntensity) {
      patchedUniforms.intensity.value =
        typeof intensity === 'undefined' ? 1.0 : intensity;
    } else {
      patchedUniforms.intensity.value = 0.0;
    }
    patchedUniforms.inverse.value = inverse ? 1.0 : 0.0;
    const numbers = new Color(color).unitArray();
    patchedUniforms.mainColor.value = new Vector3(...numbers);
    return patchedUniforms;
  }, [intensity, color]);
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
          uniforms={uniforms2}
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
