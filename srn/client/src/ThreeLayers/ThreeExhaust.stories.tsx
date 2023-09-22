import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { ThreeExhaust } from './ThreeExhaust';
import { VectorFZero } from '../utils/Vector';

export default {
  title: 'Three/Exhaust',
  argTypes: {
    rotation: {
      control: {
        type: 'range',
        min: 0.0,
        max: 2 * Math.PI,
        step: 0.01,
      },
    },
    radius: {
      control: {
        type: 'range',
        min: 10.0,
        max: 30.0,
        step: 0.5,
      },
    },
    intensity: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.1,
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
      <StoryCanvas zoom={15.0} scale={2.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeExhaust
          color={args.color}
          position={VectorFZero}
          rotation={args.rotation}
          key={JSON.stringify(args) + revision}
          radius={args.radius}
          inverse={args.inverse}
          intensity={args.useIntensity ? args.intensity : undefined}
          useIntensity={args.useIntensity}
          speedUp={args.speedUp}
        />
      </StoryCanvas>
    </div>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  rotation: 0.0,
  radius: 20.0,
  color: '#ffcb00',
  intensity: 1.0,
  useIntensity: true,
  speedUp: false,
  inverse: false,
};
