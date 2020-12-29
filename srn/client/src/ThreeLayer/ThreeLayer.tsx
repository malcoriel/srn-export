import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import {
  antiScale,
  GameState,
  height_px,
  height_units,
  min_x,
  min_y,
  Planet,
  scaleConfig,
  width_px,
  width_units,
} from '../world';
import React, { Suspense } from 'react';
import { Sphere } from './Sphere';
import _ from 'lodash';

// x -> x, y -> z to keep the axes orientation corresponding to the physics
const posToThreePos = (x: number, y: number): [number, number, number] => [
  x,
  0,
  y,
];

export const ThreePlanetShape: React.FC<Planet> = (p) => {
  const scale = _.times(3, () => p.radius) as [number, number, number];
  return (
    <group position={posToThreePos(p.x, p.y)}>
      {/*<Text*/}
      {/*  {...antiScale}*/}
      {/*  text={p.name}*/}
      {/*  fill="white"*/}
      {/*  align="center"*/}
      {/*  offsetY={scaleConfig.scaleX * p.radius + 20}*/}
      {/*  width={200}*/}
      {/*  offsetX={100}*/}
      {/*/>*/}
      <Sphere key={p.id} scale={scale} color={p.color} />
    </group>
  );
};

export const ThreeBodiesLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { planets, star } = state;
  return (
    <mesh>
      {planets.map((p) => (
        <ThreePlanetShape key={p.id} {...p} />
      ))}
    </mesh>
  );
};

export const ThreeLayer: React.FC<{ state: GameState }> = ({ state }) => (
  <Canvas
    orthographic
    camera={{
      position: new Vector3(0, 100, 0),
      zoom: 7.5,
    }}
    style={{
      position: 'absolute',
      top: 5,
      left: 5,
      width: width_px,
      height: height_px,
    }}
  >
    <Suspense fallback={<mesh />}>
      <ambientLight />
      <pointLight position={[0, 50, 0]} />
      <Sphere position={[0, 0, 0]} scale={[10, 10, 10]} />
      <Sphere
        position={[100, 0, 0]}
        scale={[10, 10, 10]}
        rotation={[90, 0, 1]}
      />
      <ThreeBodiesLayer state={state} />
    </Suspense>
    {/* blue is third coord (z?) */}
    {/* green is second  coord (y?) */}
    {/* red is first  coord (x?) */}
  </Canvas>
);
