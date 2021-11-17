import { Vector3 } from 'three';
import { FloatUniformValue, Vector3UniformValue } from './uniformTypes';
import { fractalNoise, simplexNoise3 } from './shaderFunctions';
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

#define PI 3.141592653589793238462643383279

${GLN.common}
${GLN.simplex}

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

    // smoothnes = persistance
    // detail = lacunatiry
    //
    // seed, persistance, lacunatiry, scale, distribution
    gln_tFBMOpts opts = gln_tFBMOpts(uSeed, 0.5, 2.0, 500.0, 0.1, 5, false, false);


    FragColor.x = gln_sfbm(croc.xy + t, opts);
    FragColor.y = 0.2;
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
