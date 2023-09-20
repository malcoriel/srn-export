import React, { useMemo, useRef } from 'react';
import { fragmentShader, vertexShader, uniforms } from './shaders/exhaust';
import { useFrame } from '@react-three/fiber';
import { Mesh, RawShaderMaterial, Vector3 } from 'three';
import { vecToThreePos } from './util';
import { IVector, VectorF } from '../utils/Vector';
import Color from 'color';
import _ from 'lodash';
import { useFadingMaterial } from './UseFadingMaterial';

export type ThreeExhaustProps = {
  position: IVector;
  radius: number;
  rotation: number;
  intensity: number;
  color: string;
  fadeOver?: number;
};
export const ThreeExhaust: React.FC<ThreeExhaustProps> = ({
  position,
  radius,
  rotation,
  intensity,
  color,
  fadeOver,
}) => {
  const materialRef1 = useFadingMaterial(fadeOver);
  const meshRef = useRef<Mesh>();
  useFrame(() => {
    if (meshRef && meshRef.current) {
      const shaderMat = meshRef.current.material as RawShaderMaterial;
      if (shaderMat && shaderMat.uniforms && shaderMat.uniforms.iTime) {
        shaderMat.uniforms.iTime.value += 0.1;
      }
    }
  });
  const uniforms2 = useMemo(() => {
    const patchedUniforms = _.cloneDeep(uniforms);
    patchedUniforms.intensity.value = intensity;
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
