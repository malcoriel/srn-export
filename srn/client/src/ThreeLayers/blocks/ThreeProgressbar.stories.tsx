import { StoryCanvas } from '../../TestUI/StoryCanvas';

import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import _ from 'lodash';
import { ThreeProgressbar } from './ThreeProgressbar';
import { ThreeSpaceBackground } from '../ThreeSpaceBackground';

export default {
  title: 'Three/Progressbar',
  component: ThreeProgressbar,
  argTypes: {},
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas key={revision}>
      <ThreeSpaceBackground size={256} shaderShift={0} />
      <ThreeProgressbar
        completion={0.75}
        girth={5}
        length={50}
        fillColor="red"
        backgroundColor="green"
      />
    </StoryCanvas>
  );
};

export const PartFilled = Template.bind({});
PartFilled.args = {};
