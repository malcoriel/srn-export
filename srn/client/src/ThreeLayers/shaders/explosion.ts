import { Vector3 } from 'three';
import {
  FloatUniformValue,
  TextureUniformValue,
  Vector3UniformValue,
} from './uniformTypes';
import { GLN } from './gln';

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

out vec2 relativeObjectCoord;

void main() {
  relativeObjectCoord = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const fragmentShader = `#version 300 es

precision highp float;
precision highp int;

in vec2 relativeObjectCoord;
out vec4 FragColor;

uniform vec3 color;
uniform float time;
uniform float speed;
uniform float compressX;
uniform sampler2D iChannel0;

#define PI 3.141592653589793238462643383279

float plot(vec2 st, float pct){
  return  step( pct-0.005, st.y) -
          step( pct+0.005, st.y);
}

float wave(float x, float t, float amplShift, float cutter) {
  float partN = floor(x / cutter);
  float rem = mod(partN, 2.0);
  if (rem == 1.0) {
    return 0.0;
  }
  return 0.0;
  //return log(fractal_noise(vec3(x * amplShift - t * 2.0, 0.0, 0.0), 1, 1.0, 1.0) + 1.0) / 2.0 + 0.5;
}

float final_wave(float noise1, float noise2) {
  return sin(noise1 * noise2 * 2.0 - 0.27);
}

bool limiter(vec2 croc) {
  // return abs(croc.x - croc.y) < 0.1;
  return true;
}

void main( void ) {
    vec2 roc = relativeObjectCoord;
    float t = time;
    roc.x *= compressX;
    vec2 croc = roc.xy - 0.5;
    float uSeed = 1.0;

    float red = texture(iChannel0, vec2(100.0, 100.0)).x;
    if (red > 0.1) {
      FragColor.y = 0.5;
    }
    FragColor.y = 0.0;
    FragColor.a = 1.0;
}

`;

export const uniforms: {
  iChannel0: TextureUniformValue;
  color: Vector3UniformValue;
  time: FloatUniformValue;
} = {
  iChannel0: {
    value: null,
  },
  time: {
    value: 0,
  },
  color: { value: new Vector3(0.8, 0.9, 0.8) },
};
