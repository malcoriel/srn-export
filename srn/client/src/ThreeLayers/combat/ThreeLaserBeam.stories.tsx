import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from '../ThreeSpaceBackground';
import { ThreeLaserBeam } from './ThreeLaserBeam';
import Vector from '../../utils/Vector';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const int = setInterval(() => {
      setTicks((t) => (t + 1) % 101);
    }, args.tickInterval);
    return () => clearInterval(int);
  }, [args.tickInterval]);
  return (
    <div key={`${revision}+${JSON.stringify(args)}`}>
      <StoryCanvas>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeLaserBeam
          start={new Vector(-50, 0)}
          end={new Vector(50, 25)}
          progression={ticks}
        />
      </StoryCanvas>
    </div>
  );
};

export const Slow = Template.bind({});
Slow.args = {
  tickInterval: 50,
};

export const Fast = Template.bind({});
Fast.args = {
  tickInterval: 16,
};

// noinspection JSUnusedGlobalSymbols
export default {
  title: 'Three/LaserBeam',
  component: ThreeSpaceBackground,
  argTypes: {},
} as Meta;
