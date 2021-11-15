import { Vector3 } from 'three';
import { FloatUniformValue, Vector3UniformValue } from './uniformTypes';
import { fractalNoise, simplexNoise3 } from './shaderFunctions';

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

#define PI 3.141592653589793238462643383279

${simplexNoise3}
${fractalNoise}

float plot(vec2 st, float pct){
  return  step( pct-0.005, st.y) -
          step( pct+0.005, st.y);
}


float wave(float x, float t, float amplShift) {
  return log(fractal_noise(vec3(x * amplShift - t * 2.0, 0.0, 0.0), 1, 1.0, 1.0) + 1.0) / 2.0 + 0.5;
}

float final_wave(float noise1, float noise2) {
  return noise1 * noise2 * 2.0 - 0.27;
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

    float len = length(croc);
    // if (len > 0.5) {
    //   FragColor.x = 0.0;
    // } else {
    //   FragColor.x = 0.5 n;
    // }
    // t = 10.0;

    float noise1x = wave(croc.x, t, 10.0);
    float noise2x = wave(croc.x, t, 3.41);
    float noise1y = wave(croc.y, t, 10.0);
    float noise2y = wave(croc.y, t, 3.41);
    float finalX = final_wave(noise1x, noise2x);
    float finalY = final_wave(noise1y, noise2y);
    float value = (finalX + finalY) / 2.0;
    // float value = final_wave(noise1x, noise2x);

    if (value < 0.5) {
      value = 0.0;
    }

    if (limiter(croc)) {
      FragColor.x = value;
    }

    float y = value;
    // FragColor.y = plot(roc,y);
    FragColor.a = 1.0;
}

`;

export const uniforms: {
  speed: FloatUniformValue;
  brightness: FloatUniformValue;
  time: FloatUniformValue;
  distfading: FloatUniformValue;
  twinkleSpeed: FloatUniformValue;
  compressX: FloatUniformValue;
  color: Vector3UniformValue;
} = {
  brightness: { value: 0.001 },
  distfading: { value: 0.5 },
  speed: { value: 0.000005 },
  twinkleSpeed: { value: 128 },
  time: { value: 100 },
  color: { value: new Vector3(0.8, 0.9, 0.8) },
  compressX: { value: 1.0 },
};
