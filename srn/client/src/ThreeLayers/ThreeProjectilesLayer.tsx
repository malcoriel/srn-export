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
    <group position={vecToThreePos(spatial.position)} rotation={[0, 0, r]}>
      <mesh>
        <planeBufferGeometry args={[0.5, 1.5]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0.8, -0.25]}>
        <planeBufferGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
    </group>
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
