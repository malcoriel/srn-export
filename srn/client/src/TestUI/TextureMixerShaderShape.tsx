import React, { useMemo, useRef } from 'react';
import { Mesh, ShaderMaterial, Texture } from 'three';
import { useFrame } from 'react-three-fiber';
import _ from 'lodash';
import {
  FloatUniformValue,
  TextureUniformValue,
} from '../ThreeLayers/shaders/uniformTypes';

const uniforms: {
  time: FloatUniformValue;
  mixThreshold: FloatUniformValue;
  texture1: TextureUniformValue;
  texture2: TextureUniformValue;
  texture3: TextureUniformValue;
} = {
  time: { value: 0 },
  mixThreshold: { value: 0.8 },
  texture1: { value: null },
  texture2: { value: null },
  texture3: { value: null },
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
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;
uniform float mixThreshold;

in vec2 relativeObjectCoord;
out vec4 FragColor;

void main() {
  vec3 sample1 = texture(texture1, relativeObjectCoord).xyz;
  vec3 sample2 = texture(texture2, relativeObjectCoord).xyz;
  vec3 sample3 = texture(texture3, relativeObjectCoord).xyz;
  float len1 = length(sample1);
  float len2 = length(sample2);
  float len3 = length(sample3);
  if (len3 > mixThreshold) {
    FragColor = vec4(sample3, 1.0);
  } else if (len2 > mixThreshold) {
    FragColor = vec4(sample2, 1.0);
  } else {
    FragColor = vec4(sample1, 1.0);
  }
}
`;

export const TextureMixerShaderShape: React.FC<{
  texture1: Texture;
  texture2: Texture;
  texture3: Texture;
  mixThreshold?: number;
}> = ({ texture1, texture2, texture3, mixThreshold }) => {
  const mesh = useRef<Mesh>();

  useFrame(() => {
    if (mesh.current) {
      const material = mesh.current.material as ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.time.value += 1;
      }
    }
  });

  const uniforms2 = useMemo(() => {
    const patchedUniforms = _.cloneDeep(uniforms);
    patchedUniforms.texture1.value = texture1;
    patchedUniforms.texture2.value = texture2;
    patchedUniforms.texture3.value = texture3;
    if (mixThreshold) {
      patchedUniforms.mixThreshold.value = mixThreshold;
    }
    return patchedUniforms;
  }, [texture1, texture2, texture3, mixThreshold]);

  return (
    <mesh
      position={[0, 0, 0]}
      ref={mesh}
      scale={[256, 256, 256]}
      rotation={[0, 0, 0]}
    >
      <planeBufferGeometry args={[1, 1]} />
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
    </mesh>
  );
};
