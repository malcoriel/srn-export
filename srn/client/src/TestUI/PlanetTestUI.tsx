import { useHotkeys } from 'react-hotkeys-hook';
import { TestMenuMode, useStore } from '../store';
import { Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { size, unitsToPixels_min } from '../coord';
import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from 'react-three-fiber';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { vecToThreePos } from '../ThreeLayers/ThreeLayer';
import {
  FloatUniformValue,
  TextureUniformValue,
  Vector3UniformValue,
} from '../ThreeLayers/shaders/star';
import { useRepeatWrappedTextureLoader } from '../ThreeLayers/ThreeStar';

const fragmentShader = `

`;

const uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  iResolution: Vector3UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  iResolution: { value: new Vector3(size.width_px, size.height_px, 0) },
};

const vertexShader = `
`;

const BODIES_Z = 50;

const ThreePlanetShape2: React.FC<{
  radius: number;
  position: IVector;
}> = ({ position, radius }) => {
  const mesh = useRef<Mesh>();
  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.y += 0.0005;
      const material = mesh.current.material as ShaderMaterial;
      material.uniforms.time.value += 0.005;
    }
  });

  const lavaTile = useRepeatWrappedTextureLoader('resources/lavatile.png');

  const uniforms2 = useMemo(() => {
    const patchedUniforms = uniforms;
    patchedUniforms.iChannel0.value = lavaTile;
    patchedUniforms.iResolution.value = new Vector3(
      size.width_px,
      size.height_px,
      0
    );
    return patchedUniforms;
    // eslint-disable-next-line
  }, [unitsToPixels_min()]);

  return (
    <mesh
      position={vecToThreePos(position, BODIES_Z)}
      ref={mesh}
      scale={[radius, radius, radius]}
      rotation={[0, 0, 0]}
    >
      <icosahedronBufferGeometry args={[1, 5]} />
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
    </mesh>
  );
};

export const PlanetTestUI = () => {
  const setTestMenuMode = useStore((state) => state.setTestMenuMode);
  useHotkeys('esc', () => setTestMenuMode(TestMenuMode.Shown));
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: CAMERA_DEFAULT_ZOOM(),
        far: 1000,
      }}
      style={{
        position: 'absolute',
        width: size.width_px,
        height: size.height_px,
      }}
    >
      <Suspense fallback={<mesh />}>
        <ambientLight />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <group position={[0, 0, 0]}>
          <ThreePlanetShape2 radius={20} position={VectorFzero} />
        </group>
      </Suspense>
    </Canvas>
  );
};
