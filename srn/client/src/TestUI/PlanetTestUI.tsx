import { useHotkeys } from 'react-hotkeys-hook';
import { TestMenuMode, useStore } from '../store';
import { Texture, Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { size } from '../coord';
import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from 'react-three-fiber';
import Vector from '../utils/Vector';
import Prando from 'prando';
import * as uuid from 'uuid';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import {
  gasGiantShaderRandomProps,
  variateNormal,
} from '../ThreeLayers/shaders/gasGiant';

const BackgroundPlane = () => (
  <mesh position={[0, 0, 0]}>
    <planeGeometry args={[100, 100]} />
    <meshBasicMaterial color="teal" />
  </mesh>
);

// @ts-ignore
window.variate = (min, max) => {
  return variateNormal(min, max, 1, new Prando());
};

export const PlanetTestUI = () => {
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
          <ThreePlanetShape
            gid="1"
            texture={new Texture()}
            visible
            key={`1_${revision}`}
            color="orange"
            radius={40}
            {...gasGiantShaderRandomProps(`1_${revision}`, 40)}
            position={new Vector(0, 0)}
          />
          <ThreePlanetShape
            gid="2"
            texture={new Texture()}
            visible
            key={`2_${revision}`}
            radius={15}
            {...gasGiantShaderRandomProps(`2_${revision}`, 40)}
            position={new Vector(35, 0)}
          />
          <ThreePlanetShape
            gid="3"
            texture={new Texture()}
            visible
            key={`3_${revision}`}
            {...gasGiantShaderRandomProps(`3_${revision}`, 40)}
            radius={25}
            position={new Vector(0, 35)}
          />
          <ThreePlanetShape
            gid="4"
            texture={new Texture()}
            visible
            key={`4_${revision}`}
            radius={5}
            {...gasGiantShaderRandomProps(`4_${revision}`, 40)}
            position={new Vector(0, -25)}
          />
        </group>
      </Suspense>
    </Canvas>
  );
};
