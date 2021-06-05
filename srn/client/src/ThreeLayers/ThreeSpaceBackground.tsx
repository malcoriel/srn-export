import React, { useMemo, useRef } from 'react';
import { Mesh, ShaderMaterial } from 'three';
import { useFrame } from 'react-three-fiber';
import _ from 'lodash';
import { FloatUniformValue } from './shaders/uniformTypes';
import { OrthographicCamera } from '@react-three/drei';
import { CAMERA_HEIGHT } from './CameraControls';
import { MouseEvent } from 'react-three-fiber/canvas';

const uniforms: {
  shift: FloatUniformValue;
  size: FloatUniformValue;
  boost: FloatUniformValue;
} = {
  shift: { value: 0.0 },
  size: { value: 256.0 },
  boost: { value: 1.0 },
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

uniform float size;
uniform float shift;
uniform float boost;

in vec2 relativeObjectCoord;
out vec4 FragColor;

// based on https://www.shadertoy.com/view/tst3WS

// Dave Hoskins hash functions
vec4 hash42(vec2 p)
{
    vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099));
    p4 += dot(p4, p4.wzxy+19.19);
    return fract((p4.xxyz+p4.yzzw)*p4.zywx) - 0.5;
}

vec2 hash22(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx+19.19);
    return -1.0+2.0*fract((p3.xx+p3.yz)*p3.zy);
}

// IQ's Gradient Noise
float Gradient2D( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( dot( hash22( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( hash22( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( hash22( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( hash22( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}


const vec3 cold = vec3(255.0, 244.0, 189.0)/255.0;
const vec3 hot  = vec3(181.0, 236.0, 255.0)/255.0;

vec3 StarFieldLayer(vec2 p, float du, float count, float brightness, float size)
{
    // Tiling:
    vec2 pi;
    du *= count;    p *= count;
    pi  = floor(p); p  = fract(p)-0.5;

    // Randomize position, brightness and spectrum:
    vec4 h = hash42(pi);

    // Resolution independent radius:
    float s = brightness*(0.7+0.6*h.z)*smoothstep(0.8*du, -0.2*du, length(p+0.9*h.xy) - size*du);

    return s*mix(mix(vec3(1.), cold, min(1.,-2.*h.w)), hot, max(0.,2.*h.w));
}

vec3 StarField(vec2 p, float du)
{
    vec3 c;
    c  = StarFieldLayer(p, du, 25.0, 0.18, 0.5);
    c += StarFieldLayer(p, du, 15.0, 0.25, 0.5);
    c += StarFieldLayer(p, du, 12.0, 0.50, 0.5);
    c += StarFieldLayer(p, du,  5.0, 1.00, 0.5);
    c += StarFieldLayer(p, du,  3.0, 1.00, 0.9);


    // Cluster:
    float s = 3.5*(max(0.2, Gradient2D(2.0*p*vec2(1.2,1.9)))-0.2)/(1.0-0.2);
    c += s*StarFieldLayer(p, du, 160.0, 0.10, 0.5);
    c += s*StarFieldLayer(p, du,  80.0, 0.15, 0.5);
    c += s*StarFieldLayer(p, du,  40.0, 0.25, 0.5);
    c += s*StarFieldLayer(p, du,  30.0, 0.50, 0.5);
    c += s*StarFieldLayer(p, du,  20.0, 1.00, 0.5);
    c += s*StarFieldLayer(p, du,  10.0, 1.00, 0.9);

    c *= 1.3;

    // Resolution independent brightness:
    float f = 1.0 / sqrt(660.0*du);

    return f*min(c, 1.0);
}


void main()
{
    float du = 0.25 / size;
    vec2 uv = (relativeObjectCoord - 0.5) * 2.0 + shift;
    FragColor = vec4(StarField(uv, du) * boost, 1.0);
}
`;

export const ThreeSpaceBackground: React.FC<{
  shift: number;
  size: number;
  cameraBound?: boolean;
  boost?: number;
  animationSpeed?: number;
  onClick?: () => void;
}> = ({ shift, size, onClick, cameraBound, animationSpeed, boost = 1.0 }) => {
  const mesh = useRef<Mesh>();

  useFrame(() => {
    if (mesh.current) {
      const material = mesh.current.material as ShaderMaterial;
      if (animationSpeed) {
        material.uniforms.shift.value += animationSpeed / 1000 / 600;
      }
    }
  });

  const uniforms2 = useMemo(() => {
    const patchedUniforms = _.cloneDeep(uniforms);
    patchedUniforms.size.value = size;
    patchedUniforms.shift.value = shift;
    patchedUniforms.boost.value = boost;
    return patchedUniforms;
  }, [shift, size, boost]);

  const meshZ = cameraBound ? -(CAMERA_HEIGHT + 10) : -10;
  const backgroundPlaneMesh = (
    <mesh
      onContextMenu={(e: MouseEvent) => {
        e.sourceEvent.stopPropagation();
        e.sourceEvent.preventDefault();
      }}
      onClick={onClick}
      position={[0, 0, meshZ]}
      ref={mesh}
      scale={[size, size, size]}
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
  // noinspection RequiredAttributes
  return cameraBound ? (
    <OrthographicCamera key={shift} makeDefault>
      {backgroundPlaneMesh}
    </OrthographicCamera>
  ) : (
    backgroundPlaneMesh
  );
};
