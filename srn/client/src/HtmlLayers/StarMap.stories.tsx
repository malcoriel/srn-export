import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { StarMap } from './StarMap';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import * as uuid from 'uuid';
import { ThreeStar } from '../ThreeLayers/ThreeStar';
import Vector, { VectorF } from '../utils/Vector';
import {
  liftThreePos,
  posToThreePos,
  vecToThreePos,
} from '../ThreeLayers/ThreeLayer';
import { Vector3 } from 'three/src/math/Vector3';
import { Text } from '@react-three/drei';
import { crimson, teal, yellow } from '../utils/palette';
import { ThreeLine } from '../ThreeLayers/blocks/ThreeLine';
import { Vector2 } from 'three';
import {
  makeArrowPoints,
  ThreeQuestDirectionImpl,
} from '../ThreeLayers/ThreeQuestDirection';

const xyz = (vec: Vector3): [number, number, number] => [vec.x, vec.y, vec.z];

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
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
        {args.systems.map(({ id, name, color, position }: any) => (
          <group key={id}>
            <ThreeStar
              position={new Vector3(...posToThreePos(position.x, position.y))}
              scale={[20, 20, 20]}
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
              position={vecToThreePos(position.add(VectorF(0, -30)))}
              color={teal}
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
        {args.links.map(({ from, to }: any, i: number) => (
          <ThreeLine
            key={i}
            points={[vecToThreePos(from), vecToThreePos(to)]}
            color={'red'}
            lineWidth={10}
            resolution={new Vector2(256, 256)}
          />
        ))}
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
      position: new Vector(50, 50),
    },
    {
      id: '2',
      name: 'Flop',
      color: '#38ff94',
      position: new Vector(50, -50),
    },
    {
      id: '3',
      name: 'Boop',
      color: '#fff738',
      position: new Vector(-50, 50),
    },
    {
      id: '4',
      name: 'Waaagh',
      color: '#ff6238',
      position: new Vector(-50, -50),
    },
  ],
  links: [
    {
      from: new Vector(0, 0),
      to: new Vector(50, 50),
    },
    // {
    //   from: '1',
    //   to: '4',
    // },
    // {
    //   from: '2',
    //   to: '4',
    // },
  ],
};

export default {
  title: 'UI/StarMap',
  component: StarMap,
  argTypes: {},
} as Meta;
