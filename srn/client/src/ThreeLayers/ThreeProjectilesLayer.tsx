import React from 'react';
import { ClientStateIndexes, findProperty } from '../ClientStateIndexing';
import { GameState } from '../world';
import { posToThreePos } from './util';
import { VectorFZero } from '../utils/Vector';
import { ObjectPropertyKey } from '../../../world/pkg/world.extra';
import { ObjectPropertyDecays } from '../../../world/pkg/world';
import { ThreeExplosionNodeV2 } from './blocks/ThreeExplosionNodeV2';
import { ThreeRocket } from './ThreeRocket';

export type ThreeProjectilesLayerParams = {
  visMap: Record<string, boolean>;
  indexes: ClientStateIndexes;
  state: GameState;
};

export const ThreeProjectilesLayer: React.FC<ThreeProjectilesLayerParams> = ({
  state,
}: ThreeProjectilesLayerParams) => {
  const { projectiles, explosions } = state.locations[0];
  return (
    <group>
      <group>
        {explosions.map((explosion) => {
          return (
            <group
              key={explosion.id}
              position={posToThreePos(
                explosion.spatial.position.x,
                explosion.spatial.position.y,
                3
              )}
            >
              {/*Debugging circle to show the actual explosion radius and damage zone*/}
              {/*<mesh>*/}
              {/*  <circleBufferGeometry args={[explosion.spatial.radius, 256]} />*/}
              {/*  <meshBasicMaterial color="white" />*/}
              {/*</mesh>*/}
              <ThreeExplosionNodeV2
                position={VectorFZero}
                scale={explosion.base.radius}
                seed={explosion.id}
                detail={4}
                blastTime={explosion.decay_expand.max_ticks / 1e6}
              />
            </group>
          );
        })}
      </group>
      <group>
        {projectiles.map((projectile) => {
          const decayProp = findProperty<ObjectPropertyDecays>(
            projectile.fields.properties,
            ObjectPropertyKey.Decays
          );
          return (
            <ThreeRocket
              position={projectile.fields.spatial.position}
              rotation={projectile.fields.spatial.rotation_rad}
              velocity={projectile.fields.spatial.velocity}
              fadeOver={decayProp ? decayProp.fields.max_ticks : undefined}
              radius={projectile.fields.spatial.radius}
              markers={projectile.fields.markers}
              key={projectile.fields.id}
            />
          );
        })}
      </group>
    </group>
  );
};
