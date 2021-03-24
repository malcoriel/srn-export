import { useHotkeys } from 'react-hotkeys-hook';
import { TestMenuMode, useStore } from '../store';
import { Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { size, unitsToPixels_min } from '../coord';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from 'react-three-fiber';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { vecToThreePos } from '../ThreeLayers/ThreeLayer';
import {
  FloatUniformValue,
  TextureUniformValue,
  Vector3UniformValue,
} from '../ThreeLayers/shaders/star';
import { useRepeatWrappedTextureLoader } from '../ThreeLayers/ThreeStar';

const uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  iResolution: Vector3UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  iResolution: { value: new Vector3(size.width_px, size.height_px, 0) },
};

const vertexShader = `#version 300 es
precision highp float;
precision highp int;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

in vec3 position;
in vec3 normal;
in vec2 uv;
in vec2 uv2;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform float time;
uniform sampler2D iChannel0;
uniform vec2 iResolution;
#define PI 3.14159265358979323846264338327
// uniform vec3 color;

in vec2 vUv;
out vec4 FragColor;

void main() {
  vec4 texturePix = texture(iChannel0, vUv.yx);
  FragColor = texturePix;
}

`;

const BODIES_Z = 50;

const ThreePlanetShape2: React.FC<{
  radius: number;
  position: IVector;
}> = ({ position, radius }) => {
  const mesh = useRef<Mesh>();
  useFrame(() => {
    if (mesh.current) {
      // mesh.current.rotation.y += 0.0005;
      const material = mesh.current.material as ShaderMaterial;
      material.uniforms.time.value += 0.005;
    }
  });

  const lavaTile = useRepeatWrappedTextureLoader(
    'resources/textures/jupiter.png'
  );

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
      rotation={[0, Math.PI / 2, 0]}
    >
      {/*<planeBufferGeometry args={[1, 1]} />*/}
      <icosahedronBufferGeometry args={[1, 9]} />
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
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
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
          <ThreePlanetShape2
            key={revision}
            radius={20}
            position={VectorFzero}
          />
        </group>
      </Suspense>
    </Canvas>
  );
};
