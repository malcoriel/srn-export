// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { ThreeWormhole } from './ThreeWormhole';

export default {
  title: 'Three/ThreeWormhole',
  component: ThreeWormhole,
  argTypes: {
    scale: {
      control: {
        type: 'range',
        min: 0.0,
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
      <StoryCanvas>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeWormhole
          radius={100}
          position={[0, 0, 10]}
          key={revision} // no json.stringify props because it causes remount
          scale={args.scale}
        />
      </StoryCanvas>
    </div>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  scale: 1.0,
};
