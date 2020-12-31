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

// x -> x, y -> -y to keep the axes orientation corresponding to the physics  (y down),
// xy is visible plane, z towards camera
export const posToThreePos = (
  x: number,
  y: number
): [number, number, number] => [x, -y, 0];

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

const CAMERA_HEIGHT = 50;

const CameraMover: React.FC<{ state: GameState }> = ({ state }) => {
  const myShip = findMyShip(state);
  const {
    camera, // Default camera
  } = useThree();

  if (myShip) {
    camera.position.set(myShip.x, -myShip.y, CAMERA_HEIGHT);
  }
  return null;
};

export const ThreeLayer: React.FC<{ state: GameState }> = ({ state }) => {
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: unitsToPixels,
        far: 1000,
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
        <axesHelper position={posToThreePos(15, 15)} args={[20]} />
        <CameraMover state={state} />
        <ambientLight />
        <gridHelper args={[100, 10]} rotation={[Math.PI / 2, 0, 0]} />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <ThreeBodiesLayer state={state} />
        {/*<ShipsLayer state={state} />*/}
        {/*<Sphere position={[0, 0, 0]} scale={[10, 10, 10]} star />*/}
      </Suspense>
      {/* blue is third coord (z?) */}
      {/* green is second  coord (y?) */}
      {/* red is first  coord (x?) */}
    </Canvas>
  );
};
