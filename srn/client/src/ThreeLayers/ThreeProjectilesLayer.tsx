import React from 'react';
import { SpatialProps } from '../../../world/pkg/world';
import { ClientStateIndexes } from '../ClientStateIndexing';
import { GameState } from '../world';
import { vecToThreePos } from './util';

export type ThreeProjectilesLayerParams = {
  visMap: Record<string, boolean>;
  indexes: ClientStateIndexes;
  state: GameState;
};

export interface ThreeRocketProps {
  spatial: SpatialProps;
}

const ThreeRocket: React.FC<ThreeRocketProps> = ({ spatial }) => {
  const r = spatial.rotation_rad;
  return (
    <mesh position={vecToThreePos(spatial.position)} rotation={[0, 0, r]}>
      <planeBufferGeometry args={[0.5, 1.5]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
};

export const ThreeProjectilesLayer: React.FC<ThreeProjectilesLayerParams> = ({
  state,
}: ThreeProjectilesLayerParams) => {
  const { projectiles } = state.locations[0];
  return (
    <>
      {projectiles.map((projectile) => (
        <ThreeRocket
          spatial={projectile.fields.spatial}
          key={projectile.fields.id}
        />
      ))}
    </>
  );
};
