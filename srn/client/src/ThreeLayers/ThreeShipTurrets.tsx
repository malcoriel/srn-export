import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import _ from 'lodash';
import { ThreeVectorArr, Vector3Arr } from './util';
import Vector, {
  VectorF,
  getCounterClockwiseAngleGraphics,
  getCounterClockwiseAngleMath,
} from '../utils/Vector';
import { Vector3 } from 'three';
import { ThreeLaserBeam } from './combat/ThreeLaserBeam';
import { radToDeg } from '../coord';
import { yellow } from '../utils/palette';

export interface ThreeShipTurretsProps {
  radius: number;
  count: number;
  rotation: number;
  beamWidth: number;
  position?: ThreeVectorArr;
  shootTarget: Vector;
  color: string;
}

// Y looks up!
export const getRadialCoordsMath = (
  radius: number,
  count: number,
  i: number
) => {
  const theta = ((2 * Math.PI) / count) * i;
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  return VectorF(x, y);
};

// Y looks down
export const getRadialCoordsGraphics = (
  radius: number,
  count: number,
  i: number
) => {
  const theta = ((2 * Math.PI) / count) * i;
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  return VectorF(x, -y);
};

export const ThreeShipTurrets: React.FC<ThreeShipTurretsProps> = ({
  radius,
  count,
  rotation,
  shootTarget,
  beamWidth,
  position,
}) => {
  console.log('target', shootTarget.toFix());
  const nodes = useMemo(() => {
    return _.times(count, (i) => {
      const coords = getRadialCoordsMath(radius / 1.5, count, i);
      const vector = shootTarget.subtract(coords);
      const angle = getCounterClockwiseAngleMath(VectorF(0, 1), vector);

      return {
        key: i,
        position: [coords.x, coords.y, 0] as Vector3Arr,
        vPosition: coords,
        tRotation: angle,
      };
    });
  }, [radius, count, shootTarget]);
  return (
    <group rotation={[0, 0, rotation]} position={position}>
      {nodes.map(({ position, key, vPosition, tRotation }) => {
        const r = radius / 5.0;
        return (
          <group key={key}>
            <group position={position} rotation={[0, 0, tRotation]}>
              <mesh rotation={[0, 0, 0]}>
                <circleBufferGeometry args={[r, 16]} />
                <meshBasicMaterial color="white" />
              </mesh>
              <mesh position={new Vector3(0, r / 2, 0)} rotation={[0, 0, 0]}>
                <planeBufferGeometry args={[r / 2, r * 3]} />
                <meshBasicMaterial color="white" />
              </mesh>
              <Text
                position={[0, -1, 0]}
                color={yellow}
                fontSize={1.5}
                maxWidth={20}
                lineHeight={1}
                letterSpacing={0.02}
              >
                {key}
              </Text>
            </group>
            <ThreeLaserBeam
              start={vPosition}
              end={shootTarget}
              progression={0.5}
              width={beamWidth}
              color="red"
            />
          </group>
        );
      })}
    </group>
  );
};
