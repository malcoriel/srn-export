import {
  posToThreePos,
  Vector3Arr,
  vecToThreePos,
} from '../ThreeLayers/ThreeLayer';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import { ThreeStar } from '../ThreeLayers/ThreeStar';
import { Vector3 } from 'three/src/math/Vector3';
import Vector, { VectorF } from '../utils/Vector';
import { Text } from '@react-three/drei';
import { tiffanyBlue, yellow } from '../utils/palette';
import { ThreeLine } from '../ThreeLayers/blocks/ThreeLine';
import { Vector2 } from 'three';
import React from 'react';
import _ from 'lodash';
import { Location, LocationLink } from '../../../world/pkg';

export interface StarMapProps {
  systems: Location[];
  links: LocationLink[];
}

export const makeLinkLineCoords = (args: StarMapProps) => {
  const systemsById = _.keyBy(args.systems, 'id');
  return (from: string, to: string): [Vector3Arr, Vector3Arr] | null => {
    const sys1 = systemsById[from];
    const sys2 = systemsById[to];
    if (!sys1 || !sys2) return null;
    const sys1Vec = Vector.fromIVector(sys1.position);
    const sys2Vec = Vector.fromIVector(sys2.position);
    const dir = sys2Vec.subtract(sys1Vec);
    const normDir = dir.normalize();
    const offset1 = normDir.scale(sys1.radius + 5);
    const offset2 = normDir.scale(sys2.radius + 5);
    return [sys1Vec.add(offset1), sys2Vec.subtract(offset2)].map((p) =>
      vecToThreePos(p, -5)
    ) as [Vector3Arr, Vector3Arr];
  };
};

export const StarMap: React.FC<StarMapProps> = (args) => {
  const getLinkLineCoords = makeLinkLineCoords(args);
  return (
    <>
      <mesh position={[0, 0, -10]}>
        <planeBufferGeometry args={[256, 256]} />
        <meshBasicMaterial color="teal" />
      </mesh>
      <ThreeSpaceBackground shift={0} size={256} />
      {args.systems.map(({ id, name, color, radius, position }: any) => (
        <group key={id}>
          <ThreeStar
            position={new Vector3(...posToThreePos(position.x, position.y))}
            scale={[radius, radius, radius]}
            visible
            color={color}
            coronaColor={color}
            timeScale={0.1}
            visualState={{
              boundCameraMovement: false,
              zoomShift: 1,
              cameraPosition: new Vector(0, 0),
            }}
          />
          <Text
            visible
            position={vecToThreePos(position.add(VectorF(0, -(radius + 10))))}
            color={yellow}
            fontSize={18}
            maxWidth={20}
            lineHeight={1}
            letterSpacing={0.02}
            textAlign="center"
            anchorX="center"
            anchorY="bottom" // default
          >
            {name}
          </Text>
        </group>
      ))}
      {args.links.map(
        // eslint-disable-next-line react/no-unused-prop-types
        ({ from, to }: { from: string; to: string }, i: number) => {
          const points = getLinkLineCoords(from, to);
          if (!points) return null;
          return (
            <ThreeLine
              key={i}
              points={points}
              color={tiffanyBlue}
              lineWidth={2}
              resolution={new Vector2(256, 256)}
            />
          );
        }
      )}
    </>
  );
};
