import { AsteroidBelt } from '../../../world/pkg';
import React from 'react';
import { ThreeAsteroidBelt } from './ThreeAsteroidBelt';
import { posToThreePos } from './util';

interface AsteroidBeltsLayerParams {
  asteroid_belts: AsteroidBelt[];
}

export const AsteroidBeltsLayer: React.FC<AsteroidBeltsLayerParams> = ({
  asteroid_belts,
}: AsteroidBeltsLayerParams) => (
  <>
    {asteroid_belts.map((b) => (
      <ThreeAsteroidBelt
        key={b.id}
        count={b.count}
        radius={b.spatial.radius}
        position={posToThreePos(b.spatial.position.x, b.spatial.position.y)}
        width={b.width}
        rotation={[0, 0, b.spatial.rotation_rad]}
        gid={b.id}
        scale_mod={b.scale_mod}
      />
    ))}
  </>
);
