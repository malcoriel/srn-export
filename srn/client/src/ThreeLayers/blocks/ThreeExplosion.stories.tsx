import { StoryCanvas } from '../../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeExplosionNode } from './ThreeExplosionNode';
import { ThreeExplosion } from './ThreeExplosion';

export default {
  title: 'Three/Explosion',
  component: ThreeExplosionNode,
  argTypes: {
    progressNormalized: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.01,
      },
    },
    explosionTimeFrames: {
      control: {
        type: 'range',
        min: 15.0,
        max: 240.0,
        step: 5,
      },
    },
  },
} as Meta;

const NodeTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas withBackground>
      <ThreeExplosionNode
        key={revision + JSON.stringify(args)}
        progressNormalized={args.progressNormalized}
        initialSize={5.0}
        scaleSpeed={1.05}
        explosionTimeFrames={args.explosionTimeFrames}
        autoPlay={args.autoPlay}
      />
    </StoryCanvas>
  );
};

export const Node = NodeTemplate.bind({});
Node.args = {
  autoPlay: true,
  progressNormalized: 0.0,
  explosionTimeFrames: 60,
};

const FullTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas scale={1.0} withBackground>
      <ThreeExplosion
        autoPlay={args.autoPlay}
        radius={100}
        seed={args.seed}
        key={revision + JSON.stringify(args)}
        progressNormalized={args.progressNormalized}
      />
    </StoryCanvas>
  );
};

export const Full = FullTemplate.bind({});
Full.args = {
  progressNormalized: 0.0,
  autoPlay: true,
  seed: 'abc',
  explosionTimeFrames: 60,
};
