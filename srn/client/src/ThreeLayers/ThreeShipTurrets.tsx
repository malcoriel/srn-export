import React, { useMemo } from 'react';
import _ from 'lodash';
import { Vector3Arr } from './util';
import { VectorF } from '../utils/Vector';
import { Vector3 } from 'three';

export interface ThreeShipTurretsProps {
  radius: number;
  count: number;
  rotation: number;
  color: string;
}

export const getRadialCoords = (radius: number, count: number, i: number) => {
  const theta = ((2 * Math.PI) / count) * i;
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  return VectorF(x, y);
};

export const ThreeShipTurrets: React.FC<ThreeShipTurretsProps> = ({
  radius,
  count,
  rotation,
}) => {
  const nodes = useMemo(() => {
    return _.times(count, (i) => {
      const coords = getRadialCoords(radius / 1.5, count, i);
      return {
        key: i,
        position: [coords.x, coords.y, 0] as Vector3Arr,
      };
    });
  }, [radius, count]);
  return (
    <group>
      {nodes.map(({ position, key }) => {
        const r = radius / 5.0;
        return (
          <group key={key}>
            <mesh position={position} rotation={[0, 0, 0]}>
              <circleBufferGeometry args={[r, 16]} />
              <meshBasicMaterial color="white" />
            </mesh>
            <mesh
              position={new Vector3(...position).add(new Vector3(0, r / 2, 0))}
              rotation={[0, 0, 0]}
            >
              <planeBufferGeometry args={[r / 2, r * 3]} />
              <meshBasicMaterial color="white" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
