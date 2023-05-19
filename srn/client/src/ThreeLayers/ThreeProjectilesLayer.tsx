import React from 'react';
import { ClientStateIndexes } from '../ClientStateIndexing';
import { GameState } from '../world';
import { vecToThreePos } from './util';
import { IVector, VectorF, VectorFZero } from '../utils/Vector';
import { Text } from '@react-three/drei';
import { teal } from '../utils/palette';
import { useLoader } from '@react-three/fiber';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader';

export type ThreeProjectilesLayerParams = {
  visMap: Record<string, boolean>;
  indexes: ClientStateIndexes;
  state: GameState;
};

export interface ThreeRocketProps {
  position: IVector;
  rotation: number;
  radius: number;
  markers?: string | null;
}

/**
 * @param markers
 * ↑ - gas forward, ↓ - gas backwards
 * ↷ - rotation clockwise in math coords
 * ↶ - rotation counter-clockwise in math coords
 * ← - strafe left
 * → - strafe right
 * @constructor
 */
export const MovementMarkers: React.FC<{
  markers: string;
  position: IVector;
  radius: number;
}> = ({ markers, position, radius }) => {
  return (
    <group position={vecToThreePos(position, 0)}>
      <Text
        visible
        position={vecToThreePos(VectorF(0, -(radius + 3)))}
        color={teal}
        font="resources/fonts/DejaVuSans.ttf"
        fontSize={3.0}
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="left"
        anchorX="center"
        anchorY="bottom"
      >
        {markers}
      </Text>
    </group>
  );
};

export const ThreeRocket: React.FC<ThreeRocketProps> = ({
  position,
  rotation,
  radius,
  markers,
}) => {
  return (
    <group position={vecToThreePos(position, 0)}>
      <group
        rotation={[0, 0, -(rotation - Math.PI / 2)]}
        scale={[radius, radius, radius]}
      >
        <mesh>
          <planeBufferGeometry args={[0.5, 1.5]} />
          <meshBasicMaterial color="red" />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]} position={[0, 0.8, -0.25]}>
          <planeBufferGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial color="yellow" />
        </mesh>
      </group>
      {markers && (
        <MovementMarkers
          markers={markers}
          position={VectorFZero}
          radius={radius}
        />
      )}
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
          position={projectile.fields.spatial.position}
          rotation={projectile.fields.spatial.rotation_rad}
          radius={projectile.fields.spatial.radius}
          markers={projectile.fields.markers}
          key={projectile.fields.id}
        />
      ))}
    </>
  );
};
