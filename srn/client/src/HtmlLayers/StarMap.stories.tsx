import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { StarMap } from './StarMap';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import * as uuid from 'uuid';
import Vector from '../utils/Vector';

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
          key={`${revision}+${JSON.stringify(args)}`}
          systems={args.systems}
          links={args.links}
        />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  systems: [
    {
      id: '1',
      star: {
        name: 'Dune',
        color: '#ff3880',
        radius: 20,
      },
      position: new Vector(50, 50),
    },
    {
      id: '2',
      star: {
        name: 'Flop',
        color: '#38ff94',
        radius: 10,
      },
      position: new Vector(50, -50),
    },
    {
      id: '3',
      star: {
        name: 'Boop',
        radius: 15,
        color: '#fff738',
      },
      position: new Vector(-50, 50),
    },
    {
      id: '4',
      star: {
        name: 'Waaagh',
        radius: 30,
        color: '#ff6238',
      },
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
