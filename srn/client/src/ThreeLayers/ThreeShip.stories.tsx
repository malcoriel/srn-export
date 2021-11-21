import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShip } from './ThreeShip';
import { VectorF } from '../utils/Vector';

export default {
  title: 'Three/Ship',
  component: ThreeShip,
  argTypes: {
    hpNormalized: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.1,
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
    <StoryCanvas withBackground>
      <ThreeShip
        key={revision + JSON.stringify(args)}
        blow={args.blow}
        color="red"
        gid="1"
        hpNormalized={args.hpNormalized}
        position={VectorF(0, 0)}
        radius={50.0}
        opacity={1.0}
        rotation={0.0}
        visible
        tractorTargetPosition={args.tractoring ? VectorF(250, 250) : null}
        tractorBeamWidth={5.0}
      />
    </StoryCanvas>
  );
};

export const Main = MainTemplate.bind({});
Main.args = {
  blow: false,
  hpNormalized: 1.0,
  tractoring: false,
};
