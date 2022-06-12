import React from 'react';
import { Breadcrumb } from '../../../world/pkg/world';
import { posToThreePos } from './util';
import { SHIP_FIXED_Z } from './ShipShape';
import Vector, { VectorF } from '../utils/Vector';
import _ from 'lodash';

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
  breadcrumbs: Breadcrumb[];
  currentTicks: number;
  displayForLastTicks: number;
};
export const ThreeBreadcrumbs = ({
  breadcrumbs,
  currentTicks,
  displayForLastTicks,
}: ThreeBreadcrumbsProps) => {
  const withPosKeys: (Breadcrumb & { posKey: string })[] = breadcrumbs.map(
    (b) => ({
      ...b,
      posKey: Vector.fromIVector(b.position).toKey('/', 0),
    })
  );
  const grouped = _.groupBy(withPosKeys, 'posKey');
  return (
    <group>
      {Object.entries(grouped).map(([key, breadcrumbs]) => {
        return (
          <group key={key}>
            {breadcrumbs.map(({ color, position, timestamp_ticks }, i) => {
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
              return (
                <mesh
                  key={i}
                  position={posToThreePos(pos.x, pos.y, SHIP_FIXED_Z + 10)}
                >
                  <circleBufferGeometry args={[0.25, 8]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};
