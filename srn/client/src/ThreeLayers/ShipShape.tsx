import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { Geometry } from 'three/examples/jsm/deprecated/Geometry';
import { posToThreePos, Vector3Arr } from './util';
import Vector, { VectorF } from '../utils/Vector';
import * as THREE from 'three';

const STLLoader = require('three-stl-loader')(THREE);
// ships are always 'above' the stuff
export const SHIP_FIXED_Z = 50;
export type ShipShapeProps = {
  radius: number;
  position: Vector;
  rotation: number;
  color: string;
  gid: string;
  opacity: number;
};
export const ShipShape: React.FC<ShipShapeProps> = ({
  radius,
  position,
  rotation,
  color,
  opacity,
  children,
  gid,
}) => {
  // @ts-ignore
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/models/ship.stl');

  const memoScale = useMemo(
    () => [0.15, 0.2, 0.25].map((v: number) => v * radius) as Vector3Arr,
    [radius]
  );

  // that's a hack to shift model 'forward' a little bit due
  // to shifted weight center
  const shift = VectorF(0, radius / 5.0).turnCounterClockwise(rotation);

  return (
    <group position={posToThreePos(position.x, position.y, SHIP_FIXED_Z)}>
      <mesh
        name={`ship-${gid}`}
        position={[-shift.x, shift.y, 0]}
        scale={memoScale}
        rotation={[Math.PI, 0, rotation]}
        // @ts-ignore
        geometry={shipModel}
      >
        <meshBasicMaterial color={color} opacity={opacity} transparent />
      </mesh>
      {children}
    </group>
  );
};
