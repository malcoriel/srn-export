import { useHotkeys } from 'react-hotkeys-hook';
import { TestMenuMode, useStore } from '../store';
import { Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { size, unitsToPixels_min } from '../coord';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from 'react-three-fiber';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { vecToThreePos } from '../ThreeLayers/ThreeLayer';
import {
  FloatUniformValue,
  TextureUniformValue,
  Vector3UniformValue,
} from '../ThreeLayers/shaders/star';
import { useRepeatWrappedTextureLoader } from '../ThreeLayers/ThreeStar';

const uniforms: {
  iChannel0: TextureUniformValue;
  time: FloatUniformValue;
  iResolution: Vector3UniformValue;
} = {
  iChannel0: { value: null },
  time: { value: 0 },
  iResolution: { value: new Vector3(size.width_px, size.height_px, 0) },
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

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform float time;
uniform sampler2D iChannel0;
uniform vec2 iResolution;
#define PI 3.14159265358979323846264338327
// uniform vec3 color;

in vec2 vUv;
out vec4 FragColor;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise2(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

//\tSimplex 3D Noise
//\tby Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise3(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

float noise(vec3 position, int octaves, float frequency, float persistence) {
    float total = 0.0; // Total value so far
    float maxAmplitude = 0.0; // Accumulates highest theoretical amplitude
    float amplitude = 1.0;
    for (int i = 0; i < octaves; i++) {

        // Get the noise sample
        total += snoise3(position * frequency) * amplitude;

        // Make the wavelength twice as small
        frequency *= 2.0;

        // Add to our maximum possible amplitude
        maxAmplitude += amplitude;

        // Reduce amplitude according to persistence for the next octave
        amplitude *= persistence;
    }

    // Scale the result by the maximum amplitude
    return total / maxAmplitude;
}

void main1() {
  vec2 p = -1.0 + 2.0 * vUv.xy;
  float r = sqrt(dot(p,p));
  if (r > 1.0) discard;
  float sphereIntensity = sqrt(1.0 - pow(r, 20.0));
  // float sphereIntensity = (1.0-sqrt(1.0- pow(r, 10.0)))/(r);;
  // yx to turn texture by 90deg
  vec3 texturePix = texture(iChannel0, vUv.yx).xyz;
  FragColor = vec4(texturePix * sphereIntensity, step(0.0, sphereIntensity));
}

void main() {
  vec2 p = -1.0 + 2.0 * vUv;
  vec2 uv;
  float r = dot(p,p);
  float f = (1.0-sqrt(1.0-r))/(r);
  // FragColor = vec4(length(p));
  uv.x = p.x*f / 2.0 + time / 4.0, 1.0;
  uv.y = p.y*f / 2.0 + 0.5;


  // random spots
  float s = 0.52;
  float t1 = snoise2(uv * 2.0) - s;
  float t2 = snoise2((uv + 800.0) * 2.0) - s;
  float t3 = snoise2((uv + 1600.0) * 2.0) - s;
  float threshold = max(t1 * t2 * t3, 0.0);
  float spots_noise = snoise2(uv * 0.1) * threshold;

  // curvy stuff
  uv += noise(vec3(uv, 0.0), 6, 2.0, 1.0) * 0.02 + spots_noise;

  // texturing based on curvy stuff
  FragColor = vec4(texture(iChannel0,uv.yx).xyz, step(0.0, 1.0 - r));
}

`;

const BODIES_Z = 50;

const ThreePlanetShape2: React.FC<{
  radius: number;
  position: IVector;
}> = ({ position, radius }) => {
  const mesh = useRef<Mesh>();
  useFrame(() => {
    if (mesh.current) {
      // mesh.current.rotation.y += 0.0005;
      const material = mesh.current.material as ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.time.value += 0.005;
      }
    }
  });

  const lavaTile = useRepeatWrappedTextureLoader(
    'resources/textures/jupiter-512.png'
  );

  const uniforms2 = useMemo(() => {
    const patchedUniforms = uniforms;
    patchedUniforms.iChannel0.value = lavaTile;
    patchedUniforms.iResolution.value = new Vector3(
      size.width_px,
      size.height_px,
      0
    );
    return patchedUniforms;
    // eslint-disable-next-line
  }, [unitsToPixels_min()]);

  return (
    <mesh
      position={vecToThreePos(position, BODIES_Z)}
      ref={mesh}
      scale={[radius, radius, radius]}
      rotation={[0, 0, 0]}
    >
      <planeBufferGeometry args={[3, 3]} />
      {/*<icosahedronBufferGeometry args={[1, 9]} />*/}
      <rawShaderMaterial
        transparent
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
      {/*<meshBasicMaterial color="red" />*/}
    </mesh>
  );
};

const BackgroundPlane = () => (
  <mesh position={[0, 0, 0]}>
    <planeGeometry args={[100, 100]} />
    <meshBasicMaterial color="teal" />
  </mesh>
);

export const PlanetTestUI = () => {
  const setTestMenuMode = useStore((state) => state.setTestMenuMode);
  useHotkeys('esc', () => setTestMenuMode(TestMenuMode.Shown));
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: CAMERA_DEFAULT_ZOOM(),
        far: 1000,
      }}
      style={{
        position: 'absolute',
        width: size.width_px,
        height: size.height_px,
      }}
    >
      <Suspense fallback={<mesh />}>
        <ambientLight />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <group position={[0, 0, 0]}>
          <BackgroundPlane />
          <ThreePlanetShape2
            key={revision}
            radius={20}
            position={VectorFzero}
          />
        </group>
      </Suspense>
    </Canvas>
  );
};
