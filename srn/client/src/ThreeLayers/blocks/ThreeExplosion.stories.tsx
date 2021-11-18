import { StoryCanvas } from '../../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeSpaceBackground } from '../ThreeSpaceBackground';
import { ThreeExplosionNode } from './ThreeExplosionNode';
import { ThreeExplosion } from './ThreeExplosion';

export default {
  title: 'Three/Explosion',
  component: ThreeExplosionNode,
  argTypes: {},
} as Meta;

const NodeTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas key={revision + JSON.stringify(args)} withBackground>
      <ThreeExplosionNode maxScale={10.0} initialSize={5.0} scaleSpeed={1.05} />
    </StoryCanvas>
  );
};

export const Node = NodeTemplate.bind({});
Node.args = {
  foo: 'bar',
};

const FullTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas key={revision + JSON.stringify(args)}>
      <ThreeSpaceBackground size={256} shaderShift={0} />
      <ThreeExplosion seed={args.seed} />
    </StoryCanvas>
  );
};

export const Full = FullTemplate.bind({});
Full.args = {
  seed: 'abc',
};
