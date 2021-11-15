import { StoryCanvas } from '../../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import _ from 'lodash';
import { ThreeSpaceBackground } from '../ThreeSpaceBackground';
import { ThreeExplosion } from './ThreeExplosion';

export default {
  title: 'Three/Explosion',
  component: ThreeExplosion,
  argTypes: {},
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas key={revision} scale={2.0}>
      <ThreeSpaceBackground size={512} shaderShift={0} />
      <ThreeExplosion foo="bar" />
    </StoryCanvas>
  );
};

export const Static = Template.bind({});
Static.args = {};
