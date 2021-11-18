import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShip } from './ThreeShip';
import { VectorF } from '../utils/Vector';

export default {
  title: 'Three/Ship',
  component: ThreeShip,
  argTypes: {},
} as Meta;

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas key={revision + JSON.stringify(args)} withBackground>
      <ThreeShip
        blow={args.blow}
        color="red"
        gid="1"
        hpNormalized={1.0}
        position={VectorF(0, 0)}
        radius={50.0}
        opacity={1.0}
        rotation={0.0}
        visible
      />
    </StoryCanvas>
  );
};

export const Main = MainTemplate.bind({});
Main.args = {
  blow: false,
};
