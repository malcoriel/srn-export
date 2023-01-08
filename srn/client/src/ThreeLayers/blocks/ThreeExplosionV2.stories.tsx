import { Meta, Story } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../../TestUI/StoryCanvas';
import { ThreeExplosionNodeV2 } from './ThreeExplosionNodeV2';

const NodeV2Template: Story = (args) => {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  useEffect(() => {
    const int = setInterval(() => {
      setRevision((v) => v + 1);
    }, args.blastTime * 1000);
    return () => clearInterval(int);
  }, [args.blastTime]);
  return (
    <StoryCanvas withBackground withRuler zoom={5.0}>
      <ThreeExplosionNodeV2
        key={revision + JSON.stringify(args) + 1}
        scale={args.scale}
        blastTime={args.blastTime}
        detail={args.detail}
        seed={args.seed}
      />
    </StoryCanvas>
  );
};
export const Node = NodeV2Template.bind({});
Node.args = {
  scale: 1.0,
  blastTime: 1.0,
  detail: 3,
  seed: 1,
};

export default {
  title: 'Three/ExplosionV2',
  component: ThreeExplosionNodeV2,
  argTypes: {
    blastTime: {
      control: {
        type: 'range',
        min: 0.1,
        max: 5.0,
        step: 0.01,
      },
    },
  },
} as Meta;
