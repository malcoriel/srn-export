import { Meta, Story } from '@storybook/react';
import { ThreeShipWreck } from './ThreeShipWreck';
import React, { useEffect, useState } from 'react';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import * as uuid from 'uuid';
import { VectorF } from '../utils/Vector';

export default {
  title: 'Three/ShipWreck',
  component: ThreeShipWreck,
  argTypes: {},
} as Meta;

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(0);
  return (
    <StoryCanvas withBackground withRuler zoom={5.0}>
      <ThreeShipWreck
        key={JSON.stringify(args) + revision}
        color="red"
        gid={uuid.v4()}
        opacity={1.0}
        position={VectorF(0, 0)}
        radius={5}
        rotation={0}
        {...args}
      />
    </StoryCanvas>
  );
};
export const Main = MainTemplate.bind({});
Main.args = {};
