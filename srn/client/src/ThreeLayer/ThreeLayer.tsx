import { Canvas, useThree } from 'react-three-fiber';
import { Vector3 } from 'three';
import {
  GameState,
  height_px,
  Planet,
  unitsToPixels,
  width_px,
} from '../world';
import React, { Suspense } from 'react';
import { Sphere } from './Sphere';
import _ from 'lodash';
import { findMyShip } from '../NetState';
import { ShipS } from './ShipS';
import { ShipsLayer } from './ShipsLayer';

// x -> x, y -> z to keep the axes orientation corresponding to the physics
export const posToThreePos = (
  x: number,
  y: number
): [number, number, number] => [x, 0, y];

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
    <group>
      {planets.map((p) => (
        <ThreePlanetShape key={p.id} {...p} />
      ))}
      {star && <ThreePlanetShape star={true} key={star.id} {...star} />}
    </group>
  );
};

const CameraMover: React.FC<{ state: GameState }> = ({ state }) => {
  const myShip = findMyShip(state);
  const {
    camera, // Default camera
  } = useThree();

  if (myShip) {
    camera.position.set(myShip.x, 100, myShip.y);
    // camera.lookAt(new Vector3(0, 0, 0));
  }
  return null;
};

export const ThreeLayer: React.FC<{ state: GameState }> = ({ state }) => {
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 100, 0),
        zoom: unitsToPixels,
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
        <CameraMover state={state} />
        <ambientLight />
        <gridHelper args={[100, 10]} />
        <pointLight position={[0, 50, 0]} />
        <ThreeBodiesLayer state={state} />
        <ShipsLayer state={state} />
        {/*<Sphere position={[0, -0.5, 0]} scale={[1, 1, 1]} />w*/}
      </Suspense>
      {/* blue is third coord (z?) */}
      {/* green is second  coord (y?) */}
      {/* red is first  coord (x?) */}
    </Canvas>
  );
};
