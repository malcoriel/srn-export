// forked from https://www.shadertoy.com/view/MtByRh (MIT)
import { Vector3 } from 'three';
import {
  FloatUniformValue,
  Vector2UniformValue,
  Vector3UniformValue,
} from './uniformTypes';
import { Vector2 } from 'three';
import { perlinNoise } from './shaderFunctions';

export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

uniform float iTime;

in vec2 coordNorm;
in vec3 fragCoord;
out vec4 FragColor;

#define squeeze 0.3
#define main_level 0.5
#define inner_level 0.7
#define main_color vec3(0.8, 0.6, 0.1)
#define sparkdirs 20.0
#define eps 1e-2

${perlinNoise}

#define PI 3.14159265358979323846

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

vec2 rotate(vec2 v, float angle) {
  vec2 res = vec2(0.0);
  res.x = cos(angle) * v.x - sin(angle) * v.y;
  res.y = sin(angle) * v.x + cos(angle) * v.y;
  return res;
}

float gln_rand(float n) { return fract(sin(n) * 1e4); }

void mainImage( out vec4 fragColor )
{
  vec3 color = main_color;
  fragColor.rgb = vec3(0.1);
  float flicker = 0.5 * sin(iTime * 5.0);
  float flicker2 = 0.5 * sin(iTime * 7.0);
  float border = abs(coordNorm.x / squeeze - 0.5 / squeeze );
  float cx = coordNorm.x - 0.5;
  float cy = coordNorm.y - 0.9;


  // main shape
  if (coordNorm.y > pow(border, 1.3) + main_level + flicker / 40.0) {
    fragColor.rgb = color;
    fragColor.a = 0.7;
  }
  else {
    fragColor.a = 0.0;
    float cd = sqrt(cx * cx + cy * cy);

    // make some sparks outside the main cones
    float radius = 0.8;
    float angle_step = PI / 20.0;
    for (int i = 0; i< 21; ++i) {
      float angle = (- PI / 2.0 + (angle_step * float(i))) / 4.0;
      float pcx = iTime / 4.0 + gln_rand(float(i));
      float particleCenter = (-abs(pcx) + floor(pcx)) * radius;

      if (cd <= radius && cy < 0.0) {
        float sx = cx * cos(angle) - cy * sin(angle);
        float sy = cx * sin(angle) + cy * cos(angle);
        float size = 5e-3 / cd;
        if (sy < particleCenter + size && sy > particleCenter - size && abs(sx) < size) {
          fragColor.a = 1.2 - cd / radius;

          fragColor.rgb = main_color;
        }
      }
    }
  }

  // extra inner
  if (coordNorm.y > pow(border, 1.5) + inner_level + flicker2 / 40.0) {
    fragColor.rgb += 0.1;
    fragColor.a = 0.9;
  }
}

void main() {
  mainImage(FragColor);
}
`;
export const vertexShader = `#version 300 es
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
out vec2 coordNorm;
out vec3 fragCoord;

void main() {
    coordNorm = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    fragCoord = position;
}`;

export const uniforms: {
  iTime: FloatUniformValue;
  baseColor: Vector3UniformValue;
} = {
  baseColor: { value: new Vector3(0.5, 0.5, 1.0) },
  iTime: { value: 0 },
};
