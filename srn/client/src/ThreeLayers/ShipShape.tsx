import React, { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Geometry } from 'three/examples/jsm/deprecated/Geometry';
import { posToThreePos, Vector3Arr } from './util';
import Vector, { VectorF } from '../utils/Vector';
import * as THREE from 'three';
import { SHADOW_ID } from '../StateSyncer';
import { MeshBasicMaterial } from 'three';

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
  const shift = VectorF(0, -radius / 5.0).turnCounterClockwise(-rotation);

  const material = useRef<MeshBasicMaterial>(null);
  useFrame((_state, delta) => {
    if (!material.current) {
      return;
    }
    if (!fadeOver) {
      return;
    }
    if (material.current.opacity > 0) {
      if (typeof material.current.userData.fadeTimer === 'undefined') {
        material.current.userData.fadeTimer = 0;
      }
      material.current.userData.fadeTimer += delta;
      material.current.opacity =
        opacity *
        (1.0 - Math.min(material.current.userData.fadeTimer / fadeOver, 1.0));
    }
  });

  const shipZ = gid === SHADOW_ID ? -10 : SHIP_FIXED_Z;
  return (
    <group
      position={posToThreePos(position.x, position.y, shipZ)}
      visible={visible}
    >
      <mesh
        name={`ship-${gid}`}
        position={[-shift.x, shift.y, 0]}
        scale={memoScale}
        rotation={[0, 0, rotation]}
        // @ts-ignore
        geometry={shipModel}
      >
        <meshBasicMaterial
          ref={material}
          color={color}
          opacity={opacity}
          transparent
        />
      </mesh>
      {children}
    </group>
  );
};
