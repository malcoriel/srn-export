import Vector, {
  getCounterClockwiseAngleMath,
  IVector,
  VectorF,
} from '../utils/Vector';
import React, { useMemo } from 'react';
import Color from 'color';
import _ from 'lodash';
import { posToThreePos, vec3repeat } from './util';
import { lerp } from '../world';

export interface ThreeTrajectoryItemProps {
  position: IVector;
  velocityNormalized: Vector; // len 0.0 - no speed, 1.0 - maximal speed, direction = speed direciton
  accNormalized: Vector; // len 0.0 - no acc, 1.0 - maximal acceleration
  mainColor?: string;
  accColor?: string;
  radius?: number;
  isReference?: boolean;
}

export const ThreeTrajectoryItem: React.FC<ThreeTrajectoryItemProps> = ({
  position,
  mainColor,
  accColor,
  velocityNormalized,
  accNormalized,
  radius = 1.0,
  isReference = true,
}) => {
  const showAcc = isReference && Math.abs(accNormalized.length()) > 1e-6;
  const showVel = isReference && Math.abs(velocityNormalized.length()) > 1e-6;
  const [angleVel, angleAcc] = useMemo(() => {
    const vel = showVel
      ? getCounterClockwiseAngleMath(VectorF(1, 0), velocityNormalized)
      : 0;
    const acc = showAcc
      ? getCounterClockwiseAngleMath(VectorF(1, 0), accNormalized)
      : 0;
    return [vel - Math.PI / 2, acc - Math.PI / 2];
  }, [accNormalized, velocityNormalized, showAcc, showVel]);
  const [minColorL, maxColorL, baseColor] = useMemo(() => {
    const base = new Color(mainColor);
    return [base.darken(0.25).lightness(), base.lighten(0.5).lightness(), base];
  }, [mainColor]);
  const color = useMemo(() => {
    let len = Vector.fromIVector(velocityNormalized).length();
    len = Math.max(0.0, Math.min(1.0, len));
    const lerped = lerp(minColorL, maxColorL, len);
    return _.cloneDeep(baseColor).lightness(lerped);
  }, [minColorL, maxColorL, baseColor, velocityNormalized]);
  const radiusAdjusted = isReference ? radius : radius / 3.0;
  return (
    <group
      position={posToThreePos(position.x, position.y)}
      scale={vec3repeat((1.25 / 10.0) * radiusAdjusted)}
    >
      <mesh rotation={[0, 0, angleVel]}>
        <mesh>
          <circleBufferGeometry args={[3, 16]} />
          <meshBasicMaterial
            opacity={1.0}
            transparent
            color={color.hex().toString()}
          />
        </mesh>
        {showVel && (
          <mesh
            rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
            position={[0, 1.5, -2]}
            scale={[2.5, 2.5, 2.5]}
          >
            <tetrahedronGeometry args={[2, 0]} />
            <meshBasicMaterial opacity={1.0} color={color.hex().toString()} />
          </mesh>
        )}
      </mesh>
      {showAcc && (
        <mesh rotation={[0, 0, angleAcc]}>
          <mesh
            rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
            position={[0, 2.6, -1]}
            scale={[1.5, 1.5, 0.75]}
          >
            <tetrahedronGeometry args={[2, 0]} />
            <meshBasicMaterial opacity={1.0} color={accColor} />
          </mesh>
        </mesh>
      )}
    </group>
  );
};
