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

void main1() {
  vec2 p = -1.0 + 2.0 * vUv.xy;
  float r = sqrt(dot(p,p));
  if (r > 1.0) discard;
  float sphereIntensity = sqrt(1.0 - pow(r, 20.0));
  // float sphereIntensity = (1.0-sqrt(1.0- pow(r, 10.0)))/(r);;
  // yx to turn texture by 90deg
  vec3 texturePix = texture(iChannel0, vUv.yx).xyz;
  FragColor = vec4(texturePix * sphereIntensity, step(0.0, sphereIntensity));
}

void main() {
  vec2 p = -1.0 + 2.0 * gl_FragCoord.xy / iResolution.xy;
  vec2 uv;
  float r = dot(p,p);
  float f = (1.0-sqrt(1.0-r))/(r);
  // FragColor = vec4(length(p));
  uv.x = mod(p.x*f + time, 1.0);
  uv.y = p.y*f / 2.0 + 0.5;
  FragColor = vec4(length(uv));
  FragColor = vec4(texture(iChannel0,uv.yx).xyz, 1.0);
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
      if (material.uniforms) {
        material.uniforms.time.value += 0.005;
      }
    }
  });

  const lavaTile = useRepeatWrappedTextureLoader(
    'resources/textures/jupiter-512.png'
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
      rotation={[0, 0, 0]}
    >
      <planeBufferGeometry args={[10, 10]} />
      {/*<icosahedronBufferGeometry args={[1, 9]} />*/}
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
      {/*<meshBasicMaterial color="red" />*/}
    </mesh>
  );
};

const BackgroundPlane = () => (
  <mesh position={[0, 0, 0]}>
    <planeGeometry args={[100, 100]} />
    <meshBasicMaterial color="teal" />
  </mesh>
);

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
          <BackgroundPlane />
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
