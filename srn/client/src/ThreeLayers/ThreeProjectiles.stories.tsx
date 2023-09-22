// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { VectorF, VectorFZero } from '../utils/Vector';
import { ThreeRocket } from './ThreeRocket';

export default {
  title: 'Three/Projectiles',
  argTypes: {
    rotation: {
      control: {
        type: 'range',
        min: 0.0,
        max: Math.PI * 2,
        step: 0.01,
      },
    },
    decay: {
      control: {
        type: 'boolean',
      },
    },
    turn: {
      control: {
        type: 'range',
        min: -1.0,
        max: 1.0,
        step: 0.01,
      },
    },
  },
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas withRuler zoom={16.0}>
        <ThreeSpaceBackground size={1024} shaderShift={0} />
        <ThreeRocket
          position={VectorFZero}
          velocity={VectorF(1.0, 1.0)}
          rotation={args.rotation}
          radius={1}
          gas={args.gas}
          brake={args.brake}
          turn={args.turn}
          fadeOver={args.decay ? 3e6 : undefined}
          markers="abcdef"
          key={JSON.stringify(args) + revision}
        />
      </StoryCanvas>
    </div>
  );
};

export const Rocket = Template.bind({});
Rocket.args = {
  rotation: 0.0,
  decay: false,
  gas: false,
  brake: false,
  turn: 0,
};
