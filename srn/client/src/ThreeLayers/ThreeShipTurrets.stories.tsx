import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShipTurrets } from './ThreeShipTurrets';

export default {
  title: 'Three/ShipTurrets',
  component: ThreeShipTurrets,
  argTypes: {
    rotation: {
      control: {
        type: 'range',
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
    },
  },
} as Meta;

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas withBackground zoom={15.0}>
      <ThreeShipTurrets
        count={4}
        rotation={args.rotation}
        radius={2.0}
        color="red"
        key={JSON.stringify(args) + revision}
      />
    </StoryCanvas>
  );
};

export const Main = MainTemplate.bind({});
Main.args = {
  shooting: false,
  rotation: 0.0,
};
