import React from 'react';
import { Breadcrumb } from '../../../world/pkg/world';
import { posToThreePos } from './util';
import { SHIP_FIXED_Z } from './ShipShape';

type ThreeBreadcrumbsProps = { breadcrumbs: Breadcrumb[] };
export const ThreeBreadcrumbs = ({ breadcrumbs }: ThreeBreadcrumbsProps) => {
  return (
    <group>
      {breadcrumbs.map(({ color, position }, i) => (
        <mesh
          key={i}
          position={posToThreePos(position.x, position.y, SHIP_FIXED_Z + 10)}
        >
          <circleBufferGeometry args={[0.25, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
};
