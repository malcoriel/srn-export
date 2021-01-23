import {
  FloatUniformValue,
  Vector2UniformValue,
  Vector3UniformValue,
} from './star';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector2 } from 'three';
import { normalize3, teal } from '../../utils/palette';

export const fragmentShader = `#define TAU 6.28318530718
#define MAX_ITER 5

#extension GL_OES_standard_derivatives : enable

precision highp float;
precision highp int;
uniform vec2 resolution;
uniform vec3 backgroundColor;
uniform vec3 Tiling_Caustic1477531952046_152_color;
uniform float speed;
uniform float brightness;
uniform float time;
uniform vec3 Glow_Effect1477532183055_216_color;
uniform float start;
uniform float end;
uniform float alpha;
varying vec2 vUv;
varying vec3 fPosition;
varying vec3 fNormal;
vec4 Tiling_Caustic1477531952046_152_main()
{
    vec4 Tiling_Caustic1477531952046_152_gl_FragColor = vec4(0.0);
    vec2 uv = vUv * resolution;
    vec2 p = mod(uv * TAU, TAU) - 250.0;
    vec2 i = vec2(p);
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0;
n < MAX_ITER; n++)
    {
        float t = time * speed * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= float(MAX_ITER);
    c = 1.17 - pow(c, brightness);
    vec3 rgb = vec3(pow(abs(c), 8.0));
    Tiling_Caustic1477531952046_152_gl_FragColor = vec4(rgb * Tiling_Caustic1477531952046_152_color + backgroundColor, 1.0);
    return Tiling_Caustic1477531952046_152_gl_FragColor *= 1.0;
}
vec4 Glow_Effect1477532183055_216_main()
{
    vec4 Glow_Effect1477532183055_216_gl_FragColor = vec4(0.0);
    vec3 normal = normalize(fNormal);
    vec3 eye = normalize(-fPosition.xyz);
    float rim = smoothstep(start, end, 1.0 - dot(normal, eye));
    Glow_Effect1477532183055_216_gl_FragColor = vec4(clamp(rim, 0.0, 1.0) * alpha * Glow_Effect1477532183055_216_color, 1.0);
    return Glow_Effect1477532183055_216_gl_FragColor *= 1.0;
}
void main()
{
    vec4 res = (Tiling_Caustic1477531952046_152_main() + Glow_Effect1477532183055_216_main());
    res.a = step(0.2, length(res.xyz));
    gl_FragColor = res;
}
`;
export const vertexShader = `
precision highp float;
precision highp int;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform float time;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;
varying vec3 fNormal;
varying vec3 fPosition;
vec4 Tiling_Caustic1477531952046_152_main()
{
    vec4 Tiling_Caustic1477531952046_152_gl_Position = vec4(0.0);
    vNormal = normal;
    vUv = uv;
    vUv2 = uv2;
    vPosition = position;
    Tiling_Caustic1477531952046_152_gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    return Tiling_Caustic1477531952046_152_gl_Position *= 1.0;
}
vec4 Glow_Effect1477532183055_216_main()
{
    vec4 Glow_Effect1477532183055_216_gl_Position = vec4(0.0);
    fNormal = normalize(normalMatrix * normal);
    vec4 pos = modelViewMatrix * vec4(position, 1.0);
    fPosition = pos.xyz;
    Glow_Effect1477532183055_216_gl_Position = projectionMatrix * pos;
    return Glow_Effect1477532183055_216_gl_Position *= 1.0;
}
void main()
{
    gl_Position = Tiling_Caustic1477531952046_152_main() + Glow_Effect1477532183055_216_main();
}
`;
export const uniforms: {
  time: FloatUniformValue;
  backgroundColor: Vector3UniformValue;
  Tiling_Caustic1477531952046_152_color: Vector3UniformValue;
  resolution: Vector2UniformValue;
  speed: FloatUniformValue;
  brightness: FloatUniformValue;
  Glow_Effect1477532183055_216_color: Vector3UniformValue;
  start: FloatUniformValue;
  end: FloatUniformValue;
  alpha: FloatUniformValue;
} = {
  time: { value: 0 },
  backgroundColor: { value: new Vector3(0.0, 0.0, 0.0) },
  Tiling_Caustic1477531952046_152_color: {
    value: new Vector3(...normalize3(teal)),
  },
  resolution: { value: new Vector2(1, 1) },
  speed: { value: 1.5 },
  brightness: { value: 1.5 },
  Glow_Effect1477532183055_216_color: { value: new Vector3(1, 1, 1) },
  start: { value: 0 },
  end: { value: 1.9 },
  alpha: { value: 0.1 },
};
