import { useHotkeys } from 'react-hotkeys-hook';
import { TestMenuMode, useStore } from '../store';
import { Mesh, ShaderMaterial, Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { size, unitsToPixels_min } from '../coord';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from 'react-three-fiber';
import Vector, { IVector } from '../utils/Vector';
import { vecToThreePos } from '../ThreeLayers/ThreeLayer';
import {
  FloatUniformValue,
  IntUniformValue,
  TextureUniformValue,
  Vector3UniformValue,
} from '../ThreeLayers/shaders/star';
import { useRepeatWrappedTextureLoader } from '../ThreeLayers/ThreeStar';
import { fractalNoise, simplexNoise2, simplexNoise3 } from './shaderFunctions';
import _ from 'lodash';

const defaultUniformValues = {
  detailOctaves: 5,
  spotsIntensity: 0.1,
  yStretchFactor: 1,
  spotsRandomizingFactor: 3,
  rotationSpeed: 0.01 / 60,
  spotsRotationSpeed: 0.015 / 60,
};

const uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  detailOctaves: IntUniformValue;
  rotationSpeed: FloatUniformValue;
  yStretchFactor: FloatUniformValue;
  spotsIntensity: FloatUniformValue;
  spotsRotationSpeed: FloatUniformValue;
  spotsRandomizingFactor: FloatUniformValue;
  iResolution: Vector3UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  detailOctaves: { value: defaultUniformValues.detailOctaves },
  spotsIntensity: { value: defaultUniformValues.spotsIntensity },
  spotsRandomizingFactor: {
    value: defaultUniformValues.spotsRandomizingFactor,
  },
  yStretchFactor: { value: defaultUniformValues.yStretchFactor },
  rotationSpeed: { value: defaultUniformValues.rotationSpeed }, // full rotations per frame
  spotsRotationSpeed: { value: defaultUniformValues.spotsRotationSpeed },
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

out vec2 relativeObjectCoord;

void main() {
  relativeObjectCoord = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform float time;
uniform float spotsRandomizingFactor;
uniform int detailOctaves;
uniform float rotationSpeed;
uniform float yStretchFactor;
uniform float spotsIntensity;
uniform float spotsRotationSpeed;
uniform sampler2D iChannel0;
uniform vec2 iResolution;
#define PI 3.14159265358979323846264338327
// uniform vec3 color;

in vec2 relativeObjectCoord;
out vec4 FragColor;

${simplexNoise2}
${simplexNoise3}
${fractalNoise}

void main() {
  // e.g. for a plane 0 is left bottom, 1 is right top
  vec2 centeredCoord = -1.0 + 2.0 * relativeObjectCoord;
  float distanceToCenter = dot(centeredCoord,centeredCoord);
  float sphericalDistortion = (1.0-sqrt(1.0-distanceToCenter))/(distanceToCenter);

  vec2 mainTextureCoords;
  mainTextureCoords.x = centeredCoord.x * sphericalDistortion / 2.0 + time * rotationSpeed;
  mainTextureCoords.y = centeredCoord.y * sphericalDistortion / 2.0 + 0.5;

  vec2 spots_uv;
  spots_uv.x = centeredCoord.x*sphericalDistortion / 2.0 + time * spotsRotationSpeed;
  spots_uv.y = centeredCoord.y*sphericalDistortion / 2.0 + 0.5;

  // random spots
  float spotSuppression = 0.1;
  float t1 = simplex_noise_2(spots_uv * 2.0) - spotSuppression;
  float t2 = simplex_noise_2((spots_uv + 800.0 * spotsRandomizingFactor) * 2.0) - spotSuppression;
  float t3 = simplex_noise_2((spots_uv + 1600.0 * spotsRandomizingFactor) * 2.0) - spotSuppression;
  float spotMinimalValue = 0.02;
  float threshold = max(t1 * t2 * t3, spotMinimalValue);
  float spots_noise = simplex_noise_2(spots_uv * spotsIntensity) * threshold;

  // curvy noisy lines
  float lineDistortion = fractal_noise(vec3(mainTextureCoords, 0.0), detailOctaves, 2.0, 1.0) * 0.02 + spots_noise;
  mainTextureCoords += lineDistortion;

  // texturing based on curvy stuff
  vec2 turnedTextureCoords = mainTextureCoords.yx;

  // 2.0 -> 0.25
  // 4.0 -> 0.25 + 0.125
  //

  float magicStretch = 0.5 - 1.0 / yStretchFactor / 2.0;
  turnedTextureCoords.x /= yStretchFactor;
  turnedTextureCoords.x += magicStretch;
  FragColor = vec4(texture(iChannel0, turnedTextureCoords).xyz, step(0.0, 1.0 - distanceToCenter));
}
`;

const BODIES_Z = 50;

const ThreePlanetShape2: React.FC<{
  radius: number;
  position: IVector;
  detail?: number;
  rotationSpeed?: number;
  spotsRotationSpeed?: number;
  spotsRandomizingFactor?: number;
  spotsIntensity?: number;
  yStretchFactor?: number;
}> = ({
  position,
  radius,
  detail,
  rotationSpeed,
  spotsRotationSpeed,
  yStretchFactor,
  spotsIntensity,
}) => {
  const mesh = useRef<Mesh>();
  useFrame(() => {
    if (mesh.current) {
      const material = mesh.current.material as ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.time.value += 1;
      }
    }
  });

  const lavaTile = useRepeatWrappedTextureLoader(
    'resources/textures/jupiter-512.png'
  );

  const uniforms2 = useMemo(() => {
    const patchedUniforms = _.cloneDeep(uniforms);
    patchedUniforms.iChannel0.value = lavaTile;
    patchedUniforms.rotationSpeed.value =
      rotationSpeed || defaultUniformValues.rotationSpeed;
    patchedUniforms.yStretchFactor.value =
      yStretchFactor || defaultUniformValues.yStretchFactor;
    patchedUniforms.spotsIntensity.value =
      spotsIntensity || defaultUniformValues.spotsIntensity;
    patchedUniforms.spotsRandomizingFactor.value =
      spotsIntensity || defaultUniformValues.spotsRandomizingFactor;
    patchedUniforms.spotsRotationSpeed.value =
      spotsRotationSpeed || defaultUniformValues.spotsRotationSpeed;
    patchedUniforms.detailOctaves.value =
      detail || defaultUniformValues.detailOctaves;

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
      <planeBufferGeometry args={[1, 1]} />
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
            key={`1_${revision}`}
            radius={40}
            rotationSpeed={0.005 / 60}
            spotsRotationSpeed={0.013 / 60}
            yStretchFactor={1.6}
            spotsIntensity={0.2}
            detail={6}
            spotsRandomizingFactor={2.5}
            position={new Vector(0, 0)}
          />
          <ThreePlanetShape2
            key={`2_${revision}`}
            detail={3}
            rotationSpeed={0.006 / 60}
            spotsRotationSpeed={0.016 / 60}
            radius={15}
            spotsRandomizingFactor={3.5}
            yStretchFactor={2.5}
            position={new Vector(35, 0)}
          />
          <ThreePlanetShape2
            key={`3_${revision}`}
            detail={4}
            radius={25}
            position={new Vector(0, 35)}
          />
          <ThreePlanetShape2
            key={`4_${revision}`}
            detail={3}
            rotationSpeed={0.012 / 60}
            spotsRotationSpeed={0.006 / 60}
            radius={5}
            spotsRandomizingFactor={1.0}
            position={new Vector(0, -25)}
          />
        </group>
      </Suspense>
    </Canvas>
  );
};
