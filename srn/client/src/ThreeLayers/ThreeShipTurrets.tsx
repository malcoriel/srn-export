import React, { useEffect, useMemo, useState } from 'react';
import _ from 'lodash';
import {
  threePosToVectorInv,
  ThreeVectorArr,
  Vector3Arr,
  vecToThreePosInv,
} from './util';
import Vector, {
  getCounterClockwiseAngleMath,
  getRadialCoordsMath,
  IVector,
  VectorF,
} from '../utils/Vector';
import { Vector3 } from 'three';
import { ThreeLaserBeam } from './combat/ThreeLaserBeam';
import { LongAction, ObjectSpecifier } from '../../../world/pkg';

export interface TurretProps {
  id: string;
  lockedObject?: ObjectSpecifier;
}

export interface ThreeShipTurretsProps {
  positionRadius: number;
  turrets: TurretProps[];
  rotation: number;
  beamWidth: number;
  position?: ThreeVectorArr;
  parentPosition?: ThreeVectorArr;
  color: string;
  ownRadius: number;
  longActions: LongAction[];
  findObjectPositionByIdBound: (id: string) => Vector | null;
}

const circularLerp = (a: number, b: number, pct: number) => {
  const newVal = (b - a) * pct + a;
  return newVal > Math.PI * 2 ? newVal - Math.PI * 2 : newVal;
};

export const ThreeShipTurrets: React.FC<ThreeShipTurretsProps> = ({
  positionRadius,
  turrets,
  rotation,
  beamWidth,
  position = [0, 0, 0],
  parentPosition = [0, 0, 0],
  longActions,
  findObjectPositionByIdBound,
  ownRadius,
  color,
}) => {
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
            const endShift = threePosToVectorInv(...parentPosition);
            return {
              startTurretId: (shootLongAct as any).turretId,
              end: end.add(endShift).turnCounterClockwise(-rotation),
              progression: shootLongAct.percentage,
            };
          })
          .filter((v) => !!v),
        'startTurretId'
      ),
    [longActions, findObjectPositionByIdBound, parentPosition]
  );
  const nodes = useMemo(() => {
    return _.map(turrets, (turretProps, i) => {
      const coords = getRadialCoordsMath(
        positionRadius / 1.5,
        turrets.length,
        i
      );
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
  }, [positionRadius, turrets, shoots, findObjectPositionByIdBound]);
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
    <group rotation={[0, 0, rotation]} position={position}>
      {nodes.map(({ position, key, vPosition, tRotation }) => {
        const r = ownRadius;
        const shootProps = shoots[key];
        return (
          <group key={key}>
            <group position={position} rotation={[0, 0, tRotation]}>
              <mesh rotation={[0, 0, 0]}>
                <circleBufferGeometry args={[r, 16]} />
                <meshBasicMaterial color={color} />
              </mesh>
              <mesh position={new Vector3(0, r / 2, 0)} rotation={[0, 0, 0]}>
                <planeBufferGeometry args={[r / 2, r * 3]} />
                <meshBasicMaterial color={color} />
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
