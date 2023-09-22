// forked from https://www.shadertoy.com/view/MtByRh (MIT)
import { Vector3 } from 'three';
import {
  FloatUniformValue,
  IntUniformValue,
  Vector3UniformValue,
} from './uniformTypes';

export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

uniform float iTime;
uniform float intensity;
uniform float opacity;
uniform vec3 mainColor;
uniform int inverse;

in vec2 coordNorm;
in vec3 fragCoord;
out vec4 FragColor;

#define squeeze 0.3
#define main_level 0.5
#define inner_level 0.7
#define deep_inner_level 0.85
#define sparkdirs 20.0
#define eps 1e-2

#define PI 3.14159265358979323846
#define inversePenalty 0.3

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
  vec3 color = mainColor;
  float usedIntensity = intensity;
  if (inverse == 1) {
    color -= 0.3;
    usedIntensity -= inversePenalty;
  }
  fragColor.rgb = vec3(0.1);
  float flicker = 0.5 * sin(iTime * 5.0);
  float flicker2 = 0.5 * sin(iTime * 7.0);
  float flicker3 = 0.5 * sin(iTime * 13.0);
  float border = abs(coordNorm.x / squeeze - 0.5 / squeeze );
  float cx = coordNorm.x - 0.5;
  float cy = coordNorm.y - 1.0;


  // main shape
  if (coordNorm.y > pow(border, 1.3) + main_level / pow(usedIntensity, 0.3) + flicker / 40.0) {
    fragColor.rgb = color;
    fragColor.a = 0.7 * opacity;
  }
  else {
    fragColor.a = 0.0;
    float cd = sqrt(cx * cx + cy * cy);

    // make some sparks outside the main cones

    if (usedIntensity > 0.2) {
      // force-negate intensity penalty from inversion for radius of the sparks
      usedIntensity += inversePenalty;
      float radius = 0.8 * usedIntensity;
      float angle_step = PI / 20.0;
      for (int i = 0; i < 21; ++i) {
        float angle = (- PI / 2.0 + (angle_step * float(i))) / 2.0;
        float pcx = iTime / 4.0 + gln_rand(float(i));
        float particleCenter = 0.0;
        if (inverse == 1) {
          particleCenter = (-1.0 + abs(pcx) - floor(pcx));
        }
        else {
          particleCenter = (- abs(pcx) + floor(pcx));
        }
        particleCenter *= radius;

        if (cd <= radius * usedIntensity && cy < 0.0) {
          float sx = cx * cos(angle) - cy * sin(angle);
          float sy = cx * sin(angle) + cy * cos(angle);
          float size = 5e-3 / cd * usedIntensity;
          if (sy < particleCenter + size && sy > particleCenter - size && abs(sx) < size) {
            fragColor.a = (1.2 - cd / radius * usedIntensity) * opacity;
            fragColor.rgb = mainColor;
          }
        }
      }
    }
  }

  // extra inner
  if (coordNorm.y > pow(border, 1.5) + inner_level /  pow(usedIntensity, 0.3) + flicker2 / 40.0) {
    fragColor.rgb += 0.1;
    fragColor.a = 0.9 * opacity;
  }
  // extra inner
  if (coordNorm.y > pow(border, 1.7) + deep_inner_level /  pow(usedIntensity, 0.3) + flicker3 / 40.0) {
    fragColor.rgb += 0.2;
    fragColor.a = 1.0 * opacity;
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
  intensity: FloatUniformValue;
  inverse: IntUniformValue;
  opacity: FloatUniformValue;
  mainColor: Vector3UniformValue;
} = {
  mainColor: { value: new Vector3(0.5, 0.5, 1.0) },
  iTime: { value: 0 },
  inverse: { value: 0 },
  opacity: { value: 1.0 },
  intensity: { value: 1.0 },
};
