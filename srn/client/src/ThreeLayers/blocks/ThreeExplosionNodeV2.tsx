import React, { useRef, useState } from 'react';
import { Mesh, MeshBasicMaterial, RawShaderMaterial, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { ExplosionProps } from './ThreeExplosionNode';
import {
  FloatArrayUniformValue,
  FloatUniformValue,
  IntUniformValue,
  Vector3ArrayUniformValue,
} from '../shaders/uniformTypes';
import _ from 'lodash';
import Material from 'component-material';

const uniforms: {
  time: FloatUniformValue;
  // colors: Vector3ArrayUniformValue;
  // sharpness: FloatArrayUniformValue;
  phase: IntUniformValue;
} = {
  time: { value: 0 },
  phase: { value: 0 },
  // colors: { value: [] },
  // sharpness: { value: [] },
};
import { stripIndent } from 'common-tags';
import { perlinNoise } from '../shaders/shaderFunctions';

// language=Glsl
const vertexShader = stripIndent`
    #version 300 es
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
// language=Glsl
const fragmentShader = (
  rgba1: [number, number, number, number],
  rgba2: [number, number, number, number]
) => stripIndent`
    #version 300 es
    precision highp float;
    precision highp int;
    uniform float time;
    in vec2 relativeObjectCoord;
    out vec4 FragColor;

    ${perlinNoise}

    float time_scale(float time_to_reach, float curr_time) {
        float time_remaining = max(time_to_reach - curr_time, 0.0);
        return 1.0 - (time_remaining / time_to_reach);
    }

    float animate(float from, float to, float time_to_reach, float curr_time) {
        float x = time_scale(time_to_reach, curr_time);
        float value = from + (to - from) * x;
        return value;
    }

    float animate_explosive(float from, float to, float time_to_reach, float curr_time) {
        float x = time_scale(time_to_reach, curr_time);
        x = (3.0 - (0.5 / (x + 0.15))) / 3.0;
        float value = from + (to - from) * x;
        return value;
    }

    void main() {
        FragColor = vec4(vec3(0.0), 0.0);
        vec4 color1 = vec4(${rgba1.join(',')});
        vec4 color2 = vec4(${rgba2.join(',')});
        float blast_time = 5.0;
        float blast_max_radius = 0.5;
        float smoke_start_time = blast_time * 0.75;
        float decay_start_time = blast_time * 0.25;
        float smoke_time = blast_time - smoke_start_time;
        float decay_time = blast_time - decay_start_time;
        // color 1 = mean point blast color, goes from 1.5x to 0.5x
        vec3 blast_color = color1.rgb * (2.5 - animate(0.0, 2.0, blast_time, time));
        float blast_radius = animate_explosive(0.05, blast_max_radius, blast_time, time);
        float smoke_radius = 0.0;
        if (time > smoke_start_time) {
            smoke_radius = animate(0.0, blast_max_radius, smoke_time, time - smoke_start_time);
        }
        float decay_radius = 0.0;
        if (time > decay_start_time) {
            decay_radius = animate(0.0, blast_max_radius, decay_time, time - decay_start_time);
        }

        vec2 centered_coord = vec2(relativeObjectCoord) - vec2(0.5, 0.5);
        float dist_from_center = length(centered_coord);
        float noise_coord = pNoise(relativeObjectCoord.xy * (1.0 - animate(0.0, 0.1, blast_time, time)), 3, 10.0);
        float noise_radius = + noise_coord - 0.1;
        if (dist_from_center < (blast_radius + noise_radius)) {
            FragColor += vec4(blast_color, 1.0);
        }
        if (dist_from_center < (decay_radius + noise_radius)) {
            float erasion_intensity = 1.0;
            FragColor.xyz -= vec3(erasion_intensity) * (1.0 - noise_coord);
            FragColor.a = 0.8;
        }
        if (dist_from_center < (smoke_radius + noise_radius)) {
            FragColor.a = (0.5 - animate(0.0, 0.5, smoke_time, time - smoke_start_time));
        }
    }
`;

export const ThreeExplosionNodeV2: React.FC<ExplosionProps> = ({
  initialSize,
  scaleSpeed,
  position,
  progressNormalized: progressNormalizedExt = 0.0,
  autoPlay = false,
  explosionTimeSeconds = 4,
}) => {
  const blastMesh = useRef<Mesh>();
  useFrame((_state, deltaSeconds) => {
    if (!blastMesh || !blastMesh.current) {
      return;
    }
    const material = blastMesh.current.material as RawShaderMaterial;
    if (!material.uniforms) {
      return;
    }
    material.uniforms.time.value += deltaSeconds;
    material.uniforms.phase.value = Math.round(
      material.uniforms.time.value / 0.2
    );
  });

  const uniformsInstance = _.cloneDeep(uniforms);

  return (
    <group position={position}>
      <mesh ref={blastMesh} scale={1.0}>
        <planeGeometry args={[300, 300]} />
        <rawShaderMaterial
          transparent
          fragmentShader={fragmentShader(
            [1.0, 0.6, 0.0, 0.8],
            [0.2, 0.2, 0.0, 0.8]
          )}
          vertexShader={vertexShader}
          uniforms={uniformsInstance}
        />
      </mesh>
    </group>
  );
};
