import React, { useEffect, useMemo, useState } from 'react';
import _ from 'lodash';
import { Vector3Arr, vecToThreePosInv } from './util';
import Vector, {
  getCounterClockwiseAngleMath,
  getRadialCoordsMath,
  IVector,
  VectorF,
} from '../utils/Vector';
import { Vector3 } from 'three';
import { ThreeLaserBeam } from './combat/ThreeLaserBeam';
import { LongAction, ObjectSpecifier } from '../../../world/pkg';

interface TurretProps {
  id: string;
  lockedObject?: ObjectSpecifier;
}

export interface ThreeShipTurretsProps {
  radius: number;
  turrets: TurretProps[];
  rotation: number;
  beamWidth: number;
  position?: IVector;
  color: string;
  longActions: LongAction[];
  findObjectPositionByIdBound: (id: string) => Vector | null;
}

const circularLerp = (a: number, b: number, pct: number) => {
  let sign = 1;
  if (b - a > Math.PI / 2) {
    b += Math.PI * 2;
  }
  let newVal = (b - a) * pct + a;
  return newVal > Math.PI * 2 ? newVal - Math.PI * 2 : newVal;
};

export const ThreeShipTurrets: React.FC<ThreeShipTurretsProps> = ({
  radius,
  turrets,
  rotation,
  beamWidth,
  position = VectorF(0, 0),
  longActions,
  findObjectPositionByIdBound,
}) => {
  useEffect(() => {
    console.log('mount');
    return () => console.log('unmount');
  }, []);

  // const [rotationStates, setRotationStates] = useState(
  //   turrets.reduce((acc, curr) => ({ [curr.id]: 0 }), {}) as Record<
  //     string,
  //     number
  //   >
  // );

  const shoots: Record<string, any> = useMemo(
    () =>
      _.keyBy(
        longActions
          .map((shootLongAct: LongAction) => {
            if (shootLongAct.tag !== 'Shoot') {
              return null;
            }

            if (shootLongAct.target.tag === 'Unknown') {
              return null;
            }

            const end = findObjectPositionByIdBound(shootLongAct.target.id);
            if (!end) {
              return null;
            }
            return {
              startTurretId: (shootLongAct as any).turretId,
              end,
              progression: shootLongAct.percentage,
            };
          })
          .filter((v) => !!v),
        'startTurretId'
      ),
    [longActions, findObjectPositionByIdBound]
  );
  const nodes = useMemo(() => {
    return _.map(turrets, (turretProps, i) => {
      const coords = getRadialCoordsMath(radius / 1.5, turrets.length, i);
      const shootProps = shoots[turretProps.id];
      let shootTargetV: Vector | null = null;
      if (shootProps) {
        shootTargetV = Vector.fromIVector(shootProps.end);
      } else if (turretProps.lockedObject) {
        if (turretProps.lockedObject.tag !== 'Unknown') {
          shootTargetV = findObjectPositionByIdBound(
            turretProps.lockedObject.id
          );
        }
      } else {
        shootTargetV = null;
      }
      const angle = shootTargetV
        ? getCounterClockwiseAngleMath(
            VectorF(0, 1),
            shootTargetV.subtract(coords)
          )
        : 0;

      return {
        key: turretProps.id,
        position: [coords.x, coords.y, 0] as Vector3Arr,
        vPosition: coords,
        tRotation: angle,
        progression: shootProps?.progression,
      };
    });
  }, [radius, turrets, shoots, findObjectPositionByIdBound]);
  // useEffect(() => {
  //   const rotationStatesClone = _.clone(rotationStates);
  //   for (const node of nodes) {
  //     // when progress is less than 0.2, interpolate 0-0.2
  //     // when more, jump immediately
  //     if (node && node.progression < 50) {
  //       const number = circularLerp(
  //         rotationStatesClone[node.key],
  //         node.tRotation,
  //         (node.progression * 2) / 100
  //       );
  //       rotationStatesClone[node.key] = number;
  //     } else {
  //       rotationStatesClone[node.key] = node.tRotation;
  //     }
  //   }
  //   setRotationStates(rotationStatesClone);
  // }, [nodes, setRotationStates]);
  return (
    <group rotation={[0, 0, rotation]} position={vecToThreePosInv(position)}>
      {nodes.map(({ position, key, vPosition, tRotation }) => {
        const r = radius / 5.0;
        const shootProps = shoots[key];
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
            </group>
            {shootProps && (
              <ThreeLaserBeam
                start={vPosition}
                end={shootProps.end}
                progression={shootProps.progression}
                width={beamWidth}
                color="red"
              />
            )}
          </group>
        );
      })}
    </group>
  );
};
