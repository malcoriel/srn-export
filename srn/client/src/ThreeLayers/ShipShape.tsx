import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { Geometry } from 'three/examples/jsm/deprecated/Geometry';
import { posToThreePos, Vector3Arr } from './util';
import Vector, { VectorF } from '../utils/Vector';
import * as THREE from 'three';
import { SHADOW_ID } from '../StateSyncer';
import { useFadingMaterial } from './UseFadingMaterial';

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
  fadeOver?: number;
  visible?: boolean;
};

export const ShipShape: React.FC<ShipShapeProps> = ({
  radius,
  position,
  rotation,
  color,
  opacity,
  children,
  gid,
  visible = true,
  fadeOver = undefined,
}) => {
  // @ts-ignore
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/models/ship.stl');

  const memoScale = useMemo(
    () => [0.15, 0.2, 0.25].map((v: number) => v * radius) as Vector3Arr,
    [radius]
  );

  // that's a hack to shift model 'forward' a little due
  // to shifted weight center
  const shift = VectorF(radius / 5.0, 0).turnOn(rotation);

  const materialRef = useFadingMaterial(fadeOver, opacity);

  const shipZ = gid === SHADOW_ID ? -10 : SHIP_FIXED_Z;
  return (
    <group
      position={posToThreePos(position.x, position.y, shipZ)}
      visible={visible}
    >
      <mesh
        name={`ship-${gid}`}
        position={[shift.x, shift.y, 0]}
        scale={memoScale}
        rotation={[0, 0, rotation + Math.PI / 2]}
        // @ts-ignore
        geometry={shipModel}
      >
        <meshBasicMaterial ref={materialRef} color={color} transparent />
      </mesh>
      {children}
    </group>
  );
};
