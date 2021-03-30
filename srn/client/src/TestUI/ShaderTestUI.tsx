import { useHotkeys } from 'react-hotkeys-hook';
import { TestMenuMode, useStore } from '../store';
import { Mesh, ShaderMaterial, Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { size } from '../coord';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from 'react-three-fiber';
import * as uuid from 'uuid';
import {
  FloatArrayUniformValue,
  FloatUniformValue,
  IntUniformValue,
  Vector3ArrayUniformValue,
} from '../ThreeLayers/shaders/star';
import Color from 'color';
import { normalize3 } from '../utils/palette';
import _ from 'lodash';
import Prando from 'prando';

function padArrTo<T>(arr: T[], desiredLength: number, filler: T) {
  const res = [...arr];
  while (res.length < desiredLength) {
    res.push(filler);
  }
  return res;
}

type CBS = {
  colorCount: number;
  colors: Vector3[];
  boundaries: number[];
  sharpness: number[];
};

// Fisher-Yates from https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
function shuffleWithPrng<T>(inArr: T[], prng: Prando) {
  const arr = _.cloneDeep(inArr);
  let j;
  let x;
  let i;
  for (i = arr.length - 1; i > 0; i--) {
    j = Math.floor(prng.next(0, 1) * (i + 1));
    x = arr[i];
    arr[i] = arr[j];
    arr[j] = x;
  }
  return arr;
}

const saturationSpread = 0.5; // +/- 50% of the whole range, so 0.5 is full range
const valueSpread = 0.4; // +/- 45%, so 0.5 is 0.05..0.95
const maxColors = 256;
const colorCount = 64;
const colorPicks = maxColors / colorCount;

function shuffleSlice<T>(
  arr: T[],
  prng: Prando,
  from: number,
  length: number
): T[] {
  let slice = arr.splice(from, length);
  slice = shuffleWithPrng(slice, prng);
  arr.splice(from, 0, ...slice);
  return arr;
}

const genColors = (base: Color, prng: Prando): CBS => {
  const [hue, s, v] = base.hsv().array();

  const minSat = Math.max(s - saturationSpread * 100, 0);
  const maxSat = Math.min(s + saturationSpread * 100, 100);
  const minValue = Math.max(v - valueSpread * 100, 0);
  const maxValue = Math.min(v + valueSpread * 100, 100);

  const satStep = (maxSat - minSat) / colorCount;
  const valStep = (maxValue - minValue) / colorCount;

  let colors = [];
  for (let i = colorCount - 1; i >= 0; i--) {
    let toAdd = colorPicks;
    let flip = false;
    while (toAdd > 0) {
      toAdd--;
      const newColor = Color(
        [hue, maxSat - satStep * i ** 0.85, minValue + valStep * i ** 1.05],
        'hsv'
      );
      if (flip) {
        colors.push(newColor);
      } else {
        colors.unshift(newColor);
      }
      flip = !flip;
    }
  }
  const centeredShuffleOffset = (1.0 / 3.0) * maxColors;
  const centeredShuffleLength = maxColors - 2 * centeredShuffleOffset;
  colors = shuffleSlice(
    colors,
    prng,
    centeredShuffleOffset,
    centeredShuffleLength
  );
  const sideShuffleOffset = maxColors / 5;
  const sideShuffleLength = maxColors / 8;
  colors = shuffleSlice(colors, prng, sideShuffleOffset, sideShuffleLength);
  colors = shuffleSlice(
    colors,
    prng,
    maxColors - sideShuffleOffset - sideShuffleLength,
    sideShuffleLength
  );
  // colors = shuffleSlice(
  //   colors,
  //   prng,
  //   centeredShuffleOffset,
  //   centeredShuffleLength
  // );

  const boundaryStep = 1.0 / maxColors;
  const colorsRgb = colors.map(
    (c) => new Vector3(...normalize3(c.rgb().toString()))
  );
  const middlePoint = maxColors / 2 - 0.5;

  // maximized at edges, minimzed at the middle, to
  // narrow the "hotter" middle lines
  const centerDistanceWeight = (i: number) => {
    const variable = Math.abs(middlePoint - i);
    return 10 + 10 * variable ** 0.6;
  };

  const boundaries = _.times(maxColors, (i) =>
    Number(prng.next(0, centerDistanceWeight(i)).toFixed(0))
  );
  const sum = _.sum(boundaries);
  let currentSum = 0;
  const cumulatedNormalizedBoundaries = boundaries
    .reduce((acc, curr) => {
      const res = [...acc, currentSum];
      currentSum += curr;
      return res;
    }, [] as number[])
    .map((i) => i / sum);

  const sharpness = _.times(maxColors, (i) =>
    prng.next((boundaryStep / 2) * 50.0, (boundaryStep / 2) * 100.0)
  );

  const palette = {
    // last color is a hacky bugfix, instead the shader should be shifted by some value to the right...
    colors: padArrTo(colorsRgb, maxColors + 1, colorsRgb[colorsRgb.length - 1]),
    boundaries: padArrTo(cumulatedNormalizedBoundaries, maxColors + 1, 1.0),
    sharpness: padArrTo([], maxColors, 0.01),
    colorCount: maxColors,
  };
  return palette;
};

const oyster = new Vector3(158 / 255, 141 / 255, 128 / 255);
const aluminium = new Vector3(141 / 255, 147 / 255, 181 / 255);
const uniforms: {
  time: FloatUniformValue;
  colors: Vector3ArrayUniformValue;
  boundaries: FloatArrayUniformValue;
  sharpness: FloatArrayUniformValue;
  colorCount: IntUniformValue;
} = {
  time: { value: 0 },
  colorCount: { value: 4 },
  colors: {
    value: padArrTo(
      [oyster, aluminium, oyster, aluminium],
      33,
      new Vector3(1, 1, 1)
    ),
  },
  boundaries: { value: padArrTo([0.0, 0.1, 0.3, 0.5], 33, 1.0) },
  sharpness: { value: padArrTo([0.0], 32, 0.0) },
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

// sharpness = 0.05 -> 0.095 - 0.105 - the mix, before is clean color1, after clean color2
// [color, 0.1, color, 0.3, color, 0.5, color, 1.0]

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
uniform float time;
uniform vec3 colors[${maxColors + 1}];
uniform float boundaries[${maxColors + 1}];
uniform float sharpness[${maxColors}];
uniform int colorCount;

in vec2 relativeObjectCoord;
out vec4 FragColor;

void main() {
  float relX = relativeObjectCoord.x;
  int index = 0;
  int mixed = 0;
  for (int i = 0; i < colorCount; i++) {
    if (relX >= boundaries[i] && relX < boundaries[i + 1]) {
      index = i;
    }
  }
  float left = boundaries[index + 1] - sharpness[index];
  if (relX <= left) {
    mixed = 0;
  } else {
    mixed = 1;
  }

  vec3 color;
  if (mixed == 0) {
    color = colors[index];
  } else {
    vec3 inputColor1 = colors[index];
    vec3 inputColor2 = colors[index + 1];
    color = mix(inputColor1, inputColor2, vec3((relX - left) / sharpness[index]));
  }
  FragColor = vec4(color, 1.0);
}
`;

const oysterHex = '#827A6B';
const orangeHex = '#bf8660';

export const ShaderShape: React.FC = () => {
  const mesh = useRef<Mesh>();

  const palette = useMemo(
    () => genColors(new Color(oysterHex), new Prando('#bf123123')),
    []
  );
  useFrame(() => {
    if (mesh.current) {
      const material = mesh.current.material as ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.time.value += 1;
      }
    }
  });

  const uniforms2 = useMemo(() => {
    const patchedUniforms = _.cloneDeep(uniforms);
    patchedUniforms.colors.value = palette.colors || uniforms.colors.value;
    patchedUniforms.boundaries.value =
      palette.boundaries || uniforms.boundaries.value;
    patchedUniforms.sharpness.value =
      palette.sharpness || uniforms.sharpness.value;
    patchedUniforms.colorCount.value =
      palette.colorCount || uniforms.colorCount.value;
    return patchedUniforms;
  }, [palette]);

  return (
    <mesh
      position={[0, 0, 0]}
      ref={mesh}
      scale={[30, 30, 30]}
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
};

const BackgroundPlane = () => (
  <mesh position={[0, 0, 0]}>
    <planeGeometry args={[100, 100]} />
    <meshBasicMaterial color="teal" />
  </mesh>
);

export const ShaderTestUI = () => {
  const setTestMenuMode = useStore((state) => state.setTestMenuMode);
  useHotkeys('esc', () => setTestMenuMode(TestMenuMode.Shown));
  const [revision, setRevision] = useState(uuid.v4());
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
          <ShaderShape key={revision} />
        </group>
      </Suspense>
    </Canvas>
  );
};
