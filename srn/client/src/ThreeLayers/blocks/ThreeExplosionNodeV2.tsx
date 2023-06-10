import React, { useMemo, useRef, useState } from 'react';
import { Mesh, RawShaderMaterial, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import {
  FloatArrayUniformValue,
  FloatUniformValue,
  IntUniformValue,
  Vector3ArrayUniformValue,
} from '../shaders/uniformTypes';
import _ from 'lodash';

const DEFAULT_BLAST_TIME = 1.0;
const DEFAULT_DETAIL = 3;
const DEFAULT_SEED = 1;
const uniforms: {
  time: FloatUniformValue;
  blastTime: FloatUniformValue;
  seed: FloatUniformValue;
  detail: IntUniformValue;
} = {
  time: { value: 0 },
  blastTime: { value: DEFAULT_BLAST_TIME },
  seed: { value: DEFAULT_SEED },
  detail: { value: DEFAULT_DETAIL },
};
import { stripIndent } from 'common-tags';
import { perlinNoise } from '../shaders/shaderFunctions';
import { IVector, VectorFZero } from '../../utils/Vector';
import { posToThreePos } from '../util';

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
    uniform float seed;
    uniform float blastTime;
    uniform int detail;
    in vec2 relativeObjectCoord;
    out vec4 frag_color;

    ${perlinNoise}

    vec2 rotate(vec2 v, float angle) {
        vec2 res = vec2(0.0);
        res.x = cos(angle) * v.x - sin(angle) * v.y;
        res.y = sin(angle) * v.x + cos(angle) * v.y;
        return res;
    }

    float time_scale(float time_to_reach, float curr_time) {
        float time_remaining = max(time_to_reach - curr_time, 0.0);
        return 1.0 - (time_remaining / time_to_reach);
    }

    // normal lerp
    float animate(float from, float to, float time_to_reach, float curr_time) {
        float x = time_scale(time_to_reach, curr_time);
        float value = from + (to - from) * x;
        return value;
    }

    // hyperbolic-like growth https://www.math3d.org/TDiPANp8i
    float animate_explosive(float from, float to, float time_to_reach, float curr_time) {
        float x = time_scale(time_to_reach, curr_time);
        x = (3.0 - (0.5 / (x + 0.15))) / 3.0;
        float value = from + (to - from) * x;
        return value;
    }

    void main() {
        frag_color = vec4(vec3(0.0), 0.0);
        vec4 color1 = vec4(${rgba1.join(',')});
        vec4 color2 = vec4(${rgba2.join(',')});
        float blast_time = blastTime;
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
        float noise_coord = pNoise(rotate(relativeObjectCoord.xy, seed) * (1.0 - animate(0.0, 0.1, blast_time, time)), detail, 10.0);
        float noise_radius = + noise_coord - 0.1;
        if (dist_from_center < (blast_radius + noise_radius)) {
            frag_color += vec4(blast_color, 1.0);
        }
        // debug main, blast radius without noise
        // if (dist_from_center < blast_radius) {
        //   frag_color.xyz = vec3(1.0);
        // }
        if (dist_from_center < (decay_radius + noise_radius)) {
            float erasion_intensity = 1.0;
            frag_color.xyz -= vec3(erasion_intensity) * (1.0 - noise_coord);
            frag_color.a = 0.8;
        }
        if (dist_from_center < (smoke_radius + noise_radius)) {
            frag_color.a = (0.5 - animate(0.0, 0.5, smoke_time, time - smoke_start_time));
        }

    }
`;

export type ExplosionPropsV2 = {
  position?: IVector;
  scale?: number;
  blastTime?: number;
  detail?: number;
  seed?: number;
};
const DEFAULT_SCALE = 1.0;
export const ThreeExplosionNodeV2: React.FC<ExplosionPropsV2> = ({
  position = VectorFZero,
  scale = DEFAULT_SCALE,
  blastTime = DEFAULT_BLAST_TIME,
  detail = DEFAULT_DETAIL,
  seed = DEFAULT_SEED,
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
  });

  const uniformsInstance = useMemo(() => {
    const val = _.cloneDeep(uniforms);
    val.blastTime.value = blastTime;
    val.detail.value = detail;
    val.seed.value = seed;
    return val;
  }, [blastTime, detail, seed]);

  return (
    <group position={posToThreePos(position.x, position.y)}>
      <mesh ref={blastMesh} scale={scale}>
        <circleBufferGeometry args={[1, 8]} />
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
