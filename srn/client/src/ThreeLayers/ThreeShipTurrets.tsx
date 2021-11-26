import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
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
import { yellow } from '../utils/palette';
import { LongAction } from '../../../world/pkg';

export interface ThreeShipTurretsProps {
  radius: number;
  turretIds: string[];
  rotation: number;
  beamWidth: number;
  position?: IVector;
  shootTarget: IVector;
  color: string;
  longActions: LongAction[];
  findObjectPositionByIdBound: (id: string) => Vector | null;
}

export const ThreeShipTurrets: React.FC<ThreeShipTurretsProps> = ({
  radius,
  turretIds,
  rotation,
  shootTarget,
  beamWidth,
  position = VectorF(0, 0),
  longActions,
  findObjectPositionByIdBound,
}) => {
  const shootTargetV = useMemo(() => Vector.fromIVector(shootTarget), [
    shootTarget,
  ]);

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
    return _.map(turretIds, (tid, i) => {
      const coords = getRadialCoordsMath(radius / 1.5, turretIds.length, i);
      const vector = shootTargetV.subtract(coords);
      const angle = getCounterClockwiseAngleMath(VectorF(0, 1), vector);

      return {
        key: tid,
        position: [coords.x, coords.y, 0] as Vector3Arr,
        vPosition: coords,
        tRotation: angle,
      };
    });
  }, [radius, turretIds, shootTargetV]);
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
