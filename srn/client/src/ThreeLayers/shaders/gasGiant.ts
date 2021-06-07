import Prando from 'prando';
import { Vector3 } from 'three';
import random from 'random';
import {
  FloatUniformValue,
  IntUniformValue,
  TextureUniformValue,
  Vector3UniformValue,
} from './uniformTypes';
import { size } from '../../coord';
import {
  fractalNoise,
  simplexNoise2,
  simplexNoise3,
} from '../../TestUI/shaderFunctions';

export const defaultUniformValues = {
  detailOctaves: 5,
  spotsIntensity: 0.1,
  yStretchFactor: 1,
  spotsRandomizingFactor: 3,
  rotationSpeed: 0.01 / 60,
  atmospherePercent: 0.15,
  spotsRotationSpeed: 0.015 / 60,
  atmosphereColor: new Vector3(1, 1, 1),
};
export const uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  detailOctaves: IntUniformValue;
  rotationSpeed: FloatUniformValue;
  yStretchFactor: FloatUniformValue;
  spotsIntensity: FloatUniformValue;
  spotsRotationSpeed: FloatUniformValue;
  atmospherePercent: FloatUniformValue;
  spotsRandomizingFactor: FloatUniformValue;
  iResolution: Vector3UniformValue;
  atmosphereColor: Vector3UniformValue;
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
  atmospherePercent: { value: defaultUniformValues.atmospherePercent }, // full rotations per frame
  spotsRotationSpeed: { value: defaultUniformValues.spotsRotationSpeed },
  iResolution: { value: new Vector3(size.width_px, size.height_px, 0) },
  atmosphereColor: { value: defaultUniformValues.atmosphereColor },
};
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
}`;
export const fragmentShader = `#version 300 es
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
uniform vec3 atmosphereColor;
uniform float atmospherePercent;

in vec2 relativeObjectCoord;
out vec4 FragColor;

#define PI 3.14159265358979323846264338327

${simplexNoise2}
${simplexNoise3}
${fractalNoise}


// http://www.johndcook.com/blog/2009/08/24/algorithms-convert-color-grayscale/
vec3 grayscale(in vec3 orig, in float colorFactor) {
  float grey = 0.21 * orig.r + 0.71 * orig.g + 0.07 * orig.b;
  return vec3(orig.r * colorFactor + grey * (1.0 - colorFactor),
    orig.g * colorFactor + grey * (1.0 - colorFactor),
    orig.b * colorFactor + grey * (1.0 - colorFactor));
}


float sharpSpike(in float x, in float shiftX, in float power) {
  return 1.0-sqrt(abs(1.0-pow(x + shiftX, power)));
}

void main() {
  vec2 centeredCoord = -1.0 + 2.0 * relativeObjectCoord;
  float distanceToCenter = dot(centeredCoord,centeredCoord) / (1.0 - atmospherePercent);
  float trueDistanceToCenter = dot(centeredCoord,centeredCoord);
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

  float magicStretch = 0.5 - 1.0 / yStretchFactor / 2.0;
  turnedTextureCoords.x /= yStretchFactor;
  turnedTextureCoords.x += magicStretch;
  float alpha = step(0.0, 1.0 - trueDistanceToCenter);
  FragColor = vec4(texture(iChannel0, turnedTextureCoords).xyz, alpha);

  // 'atmospheric' glow on the edge
  float insideShift = 0.0; // 0.45; // shift the glow closer to the center

  // these two control the tilt and the shift of the spike in the atmospheric glow
  float k = 2.0;
  float shift = 0.95;
  float glowBase = sharpSpike(trueDistanceToCenter * k, - shift + atmospherePercent, 2.0) + 0.2;

  if (trueDistanceToCenter > (1.0 - atmospherePercent)) {
    // FragColor.xyz = vec3(0.0, 1.0, 0.0);
    FragColor.xyz = vec3(glowBase) * atmosphereColor;
    // FragColor.a = 1.0 - pow(trueDistanceToCenter, 3.0);
  }

  // debug borders between surface and atmosphere
  // if (abs(distanceToCenter - 1.0) < 0.01) {
  //   FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  // }
  //
  // if (abs(trueDistanceToCenter - 1.0) < 0.01) {
  //   FragColor = vec4(0.0, 0.0, 1.0, 1.0);
  // }
}
`;
export const variateUniform = (min: number, max: number, prng: Prando) => {
  return prng.next(min, max + 1e-10);
};
const randomCompatiblePrng = (prng: Prando) => {
  return () => prng.next(0, 1);
};
export const variateNormal = (
  min: number,
  max: number,
  variance: number,
  prng: Prando
) => {
  const cloned = random.clone('');
  // @ts-ignore
  cloned.use(randomCompatiblePrng(prng));
  let value = cloned.normal((max - min) / 2 + min, variance)();
  value = Math.max(min, value);
  value = Math.min(max, value);
  return value;
};
export const gasGiantShaderRandomProps = (seed: string, radius: number) => {
  const prng = new Prando(seed);
  let detail;
  if (radius > 30) {
    detail = 6;
  } else if (radius > 20) {
    detail = 5;
  } else if (radius > 10) {
    detail = 4;
  } else {
    detail = 3;
  }
  return {
    detail,
    rotationSpeed: variateNormal(0.002, 0.006, 0.003, prng) / 30,
    spotsRotationSpeed: variateNormal(0.002, 0.06, 0.0005, prng) / 30,
    spotsRandomizingFactor: variateUniform(1, 10, prng),
    spotsIntensity: variateNormal(0.01, 0.2, 0.05, prng),
    yStretchFactor: variateNormal(1.0, 2.5, 0.5, prng),
  };
};
