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
import { darkGreen, tiffanyBlue, yellow } from '../utils/palette';
import { ThreeLine } from '../ThreeLayers/blocks/ThreeLine';
import { Vector2 } from 'three';
import React from 'react';
import _ from 'lodash';
import { Location, LocationLink } from '../../../world/pkg';

export interface StarMapProps {
  systems: Location[];
  links: LocationLink[];
  size: number;
  onSystemClick?: (systemId: string) => void;
}

export const makeLinkLineCoords = (systems: Location[]) => {
  const systemsById = _.keyBy(systems, 'id');
  return (from: string, to: string): [Vector3Arr, Vector3Arr] | null => {
    const sys1 = systemsById[from];
    const sys2 = systemsById[to];
    if (!sys1 || !sys2) return null;
    if (!sys1.star || !sys2.star) return null;
    if (!sys1.star.radius || !sys2.star.radius) return null;
    if (sys1.id === sys2.id) return null;
    const sys1Vec = Vector.fromIVector(sys1.position);
    const sys2Vec = Vector.fromIVector(sys2.position);
    const dir = sys2Vec.subtract(sys1Vec);
    const normDir = dir.normalize();
    if (!normDir) return null;
    const offset1 = normDir.scale(sys1.star.radius + 5);
    const offset2 = normDir.scale(sys2.star.radius + 5);
    if (_.isNaN(offset1.x) || _.isNaN(offset1.y)) return null;
    return [sys1Vec.add(offset1), sys2Vec.subtract(offset2)].map((p) =>
      vecToThreePos(p, -5)
    ) as [Vector3Arr, Vector3Arr];
  };
};

export const StarMap: React.FC<StarMapProps> = ({
  links,
  systems,
  onSystemClick,
  size,
}) => {
  const getLinkLineCoords = makeLinkLineCoords(systems);
  let currentSystem = null;
  if (systems.length > 0 && systems[0].star) {
    currentSystem = systems[0];
  }
  return (
    <>
      <ThreeSpaceBackground shaderShift={0} size={size} />
      {systems.map(({ id, star, position: rawPosition }) => {
        if (!star) {
          return null;
        }
        const onClick = onSystemClick ? () => onSystemClick(id) : undefined;
        const position = Vector.fromIVector(rawPosition);
        const { color, radius, name } = star;
        return (
          <group key={id}>
            <ThreeStar
              onClick={onClick}
              position={new Vector3(...posToThreePos(position.x, position.y))}
              scale={[radius, radius, radius]}
              visible
              color={color}
              coronaColor={color}
              timeScale={0.5}
              visualState={{
                boundCameraMovement: false,
                zoomShift: 1,
                cameraPosition: new Vector(0, 0),
              }}
            />
            <Text
              onClick={onClick}
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
        );
      })}
      {links.map(
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
      {currentSystem && currentSystem.star && (
        <group
          position={posToThreePos(
            currentSystem.position.x,
            currentSystem.position.y,
            0
          )}
        >
          <mesh>
            <ringGeometry
              args={[
                currentSystem.star.radius - 2.5,
                currentSystem.star.radius - 1.0,
                128,
              ]}
            />
            <meshBasicMaterial color={darkGreen} />
          </mesh>
        </group>
      )}
    </>
  );
};
