import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { StarMap } from './StarMap';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import * as uuid from 'uuid';
import { ThreeStar } from '../ThreeLayers/ThreeStar';
import Vector, { VectorF } from '../utils/Vector';
import {
  posToThreePos,
  Vector3Arr,
  vecToThreePos,
} from '../ThreeLayers/ThreeLayer';
import { Vector3 } from 'three/src/math/Vector3';
import { Text } from '@react-three/drei';
import { blue, crimson, teal, tiffanyBlue, yellow } from '../utils/palette';
import { ThreeLine } from '../ThreeLayers/blocks/ThreeLine';
import { Vector2 } from 'three';
import _ from 'lodash';

const xyz = (vec: Vector3): [number, number, number] => [vec.x, vec.y, vec.z];

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const systemsById = _.keyBy(args.systems, 'id');
  const getLinkLineCoords = (
    from: string,
    to: string
  ): [Vector3Arr, Vector3Arr] | null => {
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
  return (
    <div style={{ width: 256, height: 256, position: 'relative' }}>
      <StoryCanvas
        styles={{ position: 'absolute', top: 0, left: 0, zIndex: -5 }}
      >
        <mesh position={[0, 0, -10]}>
          <planeBufferGeometry args={[256, 256]} />
          <meshBasicMaterial color="teal" />
        </mesh>
        <ThreeSpaceBackground
          key={`${revision}+${JSON.stringify(args)}`}
          shift={0}
          size={256}
        />
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
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  systems: [
    {
      id: '1',
      name: 'Dune',
      color: '#ff3880',
      radius: 20,
      position: new Vector(50, 50),
    },
    {
      id: '2',
      name: 'Flop',
      color: '#38ff94',
      radius: 10,
      position: new Vector(50, -50),
    },
    {
      id: '3',
      name: 'Boop',
      radius: 15,
      color: '#fff738',
      position: new Vector(-50, 50),
    },
    {
      id: '4',
      name: 'Waaagh',
      radius: 30,
      color: '#ff6238',
      position: new Vector(-50, -50),
    },
  ],
  links: [
    {
      from: '1',
      to: '4',
    },
    {
      from: '2',
      to: '4',
    },
    {
      from: '1',
      to: '2',
    },
  ],
};

export default {
  title: 'UI/StarMap',
  component: StarMap,
  argTypes: {},
} as Meta;
