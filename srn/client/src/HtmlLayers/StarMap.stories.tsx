import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { StarMap, StarMapProps } from './StarMap';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import * as uuid from 'uuid';
import Vector, { VectorF } from '../utils/Vector';
import { DEFAULT_STATE, Location } from '../world';

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
        <StarMap
          size={256}
          key={`${revision}+${JSON.stringify(args)}`}
          systems={args.systems}
          links={args.links}
        />
      </StoryCanvas>
    </div>
  );
};

const mockLocation = (
  id: string,
  starName: string,
  starColor: string,
  starPos: Vector,
  starRadius: number
): Location => ({
  ...DEFAULT_STATE.locations[0],
  star: {
    id,
    name: starName,
    color: starColor,
    corona_color: starColor,
    spatial: {
      radius: starRadius,
      position: VectorF(0, 0),
      velocity: VectorF(0, 0),
      angular_velocity: 0,
      rotation_rad: 0,
    },
    movement: { tag: 'None' },
    rot_movement: { tag: 'None' },
  },
});

export const Main = Template.bind({});
const args: StarMapProps = {
  systems: [
    mockLocation('1', 'Dune', '#ff3880', VectorF(50, 50), 20),
    mockLocation('2', 'Flop', '#38ff94', new Vector(50, -50), 10),
    mockLocation('3', 'Boop', '#fff738', new Vector(-50, 50), 15),
    mockLocation('4', 'Waaagh', '#ff6238', new Vector(-50, -50), 30),
  ],
  size: 600,
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
Main.args = args;

export default {
  title: 'UI/StarMap',
  component: StarMap,
  argTypes: {},
} as Meta;
