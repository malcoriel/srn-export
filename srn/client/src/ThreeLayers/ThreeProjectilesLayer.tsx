import React from 'react';
import { ClientStateIndexes, findProperty } from '../ClientStateIndexing';
import { GameState } from '../world';
import { posToThreePos, vecToThreePos } from './util';
import { IVector, VectorF, VectorFZero } from '../utils/Vector';
import { useFadingMaterial } from './UseFadingMaterial';
import { ObjectPropertyKey } from '../../../world/pkg/world.extra';
import { ObjectPropertyDecays } from '../../../world/pkg/world';
import { ThreeExplosionNodeV2 } from './blocks/ThreeExplosionNodeV2';
import { useStore } from '../store';
import { ThreeExhaust } from './ThreeExhaust';
import { MovementMarkers } from './MovementMarkers';

export type ThreeProjectilesLayerParams = {
  visMap: Record<string, boolean>;
  indexes: ClientStateIndexes;
  state: GameState;
};

export interface ThreeRocketProps {
  position: IVector;
  velocity: IVector;
  rotation: number;
  radius: number;
  fadeOver?: number;
  markers?: string | null;
}

export const ThreeRocket: React.FC<ThreeRocketProps> = ({
  position,
  rotation,
  radius,
  velocity,
  fadeOver,
  markers,
}) => {
  const materialRef1 = useFadingMaterial(fadeOver, 1.0);

  const showGrid = useStore((srnState) => srnState.hotkeysPressed['show grid']);

  return (
    <group position={vecToThreePos(position, 0)}>
      <group
        rotation={[0, 0, rotation + Math.PI / 2]}
        scale={[radius, radius, radius]}
      >
        <mesh>
          <planeBufferGeometry args={[0.5, 1.5]} />
          <meshBasicMaterial color="red" transparent ref={materialRef1} />
        </mesh>
        <ThreeExhaust
          color="#ff0"
          intensity={1.0}
          position={VectorF(0, 0.75 * radius)}
          radius={radius * 3.0}
          rotation={-Math.PI / 2.0}
          fadeOver={fadeOver}
        />
      </group>
      {markers && showGrid && (
        <MovementMarkers
          markers={markers}
          position={VectorFZero}
          velocity={velocity}
          radius={radius}
        />
      )}
    </group>
  );
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
