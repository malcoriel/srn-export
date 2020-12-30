import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import { GameState, height_px, Planet, width_px } from '../world';
import React, { Suspense } from 'react';
import { ShaderTest, Sphere } from './Sphere';
import _ from 'lodash';

// x -> x, y -> z to keep the axes orientation corresponding to the physics
const posToThreePos = (x: number, y: number): [number, number, number] => [
  x,
  0,
  y,
];

export const ThreePlanetShape: React.FC<Planet & { star?: boolean }> = (p) => {
  const scale = _.times(3, () => p.radius) as [number, number, number];
  return (
    <Sphere
      position={posToThreePos(p.x, p.y)}
      key={p.id}
      scale={scale}
      color={p.color}
      star={p.star}
    />
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
      {star && <ThreePlanetShape star={true} key={star.id} {...star} />}
    </mesh>
  );
};

export const ThreeLayer: React.FC<{ state: GameState }> = ({ state }) => (
  <Canvas
    orthographic
    camera={{
      position: new Vector3(0, 100, 0),
      zoom: 7, // that's some stupid magic - I don't know why specifying this zoom leads to 1:1 px mapping
      far: 200,
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
      <gridHelper args={[100, 10]} />
      <pointLight position={[0, 50, 0]} />
      <ThreeBodiesLayer state={state} />
      {/*<Sphere position={[0, -0.5, 0]} scale={[1, 1, 1]} />w*/}
      <ShaderTest position={[0, 0, 0]} />
    </Suspense>
    {/* blue is third coord (z?) */}
    {/* green is second  coord (y?) */}
    {/* red is first  coord (x?) */}
  </Canvas>
);
