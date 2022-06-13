import React from 'react';
import { Breadcrumb } from '../../../world/pkg/world';
import { posToThreePos } from './util';
import { SHIP_FIXED_Z } from './ShipShape';
import Vector, { VectorF } from '../utils/Vector';
import _ from 'lodash';
import { BreadcrumbLine } from '../NetState';

const roundPos = (
  around: Vector,
  radius: number,
  index: number,
  total: number
): Vector => {
  const a = index * ((Math.PI * 2) / total);
  const x = radius * Math.cos(a);
  const y = radius * Math.sin(a);
  return around.add(VectorF(x, y));
};

type ThreeBreadcrumbsProps = {
  breadcrumbs: (Breadcrumb | BreadcrumbLine)[];
  currentTicks: number;
  displayForLastTicks: number;
};
export const ThreeBreadcrumbs = ({
  breadcrumbs,
  currentTicks,
  displayForLastTicks,
}: ThreeBreadcrumbsProps) => {
  const withPosKeys: ((Breadcrumb | BreadcrumbLine) & {
    posKey: string;
  })[] = breadcrumbs.map((b) => ({
    ...b,
    posKey: Vector.fromIVector(b.position).toKey('/', 0),
  }));
  const grouped = _.groupBy(withPosKeys, 'posKey');
  return (
    <group>
      {Object.entries(grouped).map(([key, breadcrumbs]) => {
        return (
          <group key={key}>
            {breadcrumbs.map(
              ({ color, position, timestamp_ticks, ...rest }, i) => {
                if (currentTicks >= timestamp_ticks + displayForLastTicks) {
                  return null;
                }
                let pos;
                if (breadcrumbs.length > 1) {
                  pos = roundPos(
                    Vector.fromIVector(position),
                    0.125,
                    i,
                    breadcrumbs.length
                  );
                } else {
                  pos = position;
                }
                const to = (rest as any).to;
                if (!to) {
                  return (
                    <mesh
                      key={i}
                      position={posToThreePos(pos.x, pos.y, SHIP_FIXED_Z + 10)}
                    >
                      <circleBufferGeometry args={[0.25, 8]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                  );
                }
                const toPoint = Vector.fromIVector(to);
                const fromPoint = Vector.fromIVector(position);
                const length = toPoint.euDistTo(fromPoint);
                const dir = toPoint.subtract(fromPoint);
                const angle = dir.angleRad(VectorF(1.0, 0.0));
                const shift = dir.scale(0.5);
                const truePos = Vector.fromIVector(pos).add(shift);
                return (
                  <mesh
                    rotation={[0, 0, angle]}
                    key={i}
                    position={posToThreePos(
                      truePos.x,
                      truePos.y,
                      SHIP_FIXED_Z + 10
                    )}
                  >
                    <planeBufferGeometry args={[length, 0.1]} />
                    <meshBasicMaterial color={color} />
                  </mesh>
                );
              }
            )}
          </group>
        );
      })}
    </group>
  );
};
