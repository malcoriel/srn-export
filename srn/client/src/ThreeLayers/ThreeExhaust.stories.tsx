import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { ThreeExhaust } from './ThreeExhaust';

export default {
  title: 'Three/ThreeExhaust',
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
        min: 1.0,
        max: 10.0,
        step: 0.5,
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
          position={[0, 0, 10]}
          rotation={args.rotation}
          key={revision} // no json.stringify props because it causes remount
          radius={args.radius}
        />
      </StoryCanvas>
    </div>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  rotation: 0.0,
  radius: 20.0,
};
