import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import Vector, { VectorF, VectorFZero } from '../utils/Vector';
import {
  ThreeTrajectoryItem,
  ThreeTrajectoryItemProps,
} from './ThreeTrajectoryItem';
import { ThreeTrajectory } from './ThreeTrajectory';

const SingleItemTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas zoom={16.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeTrajectoryItem
          key={`${revision}+${JSON.stringify(args)}`}
          position={VectorF(0, 0)}
          velocityNormalized={VectorF(args.velX, args.velY)}
          accNormalized={VectorF(args.accX, args.accY)}
          mainColor="teal"
          accColor="red"
        />
      </StoryCanvas>
    </div>
  );
};

export const SingleItem = SingleItemTemplate.bind({});
SingleItem.args = {
  velX: 0.7,
  velY: 1,
  accX: 0,
  accY: 1,
};

const StartAndStopTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas zoom={1.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeTrajectory
          key={`${revision}+${JSON.stringify(args)}`}
          items={args.items}
        />
      </StoryCanvas>
    </div>
  );
};

export const StartAndStop = StartAndStopTemplate.bind({});
const startAndStopTrajectory: ThreeTrajectoryItemProps[] = [
  {
    position: VectorF(-50, 0),
    velocityNormalized: VectorFZero,
    accNormalized: VectorFZero,
  },
  {
    position: VectorF(-40, 0),
    velocityNormalized: VectorF(0.25, 0),
    accNormalized: VectorF(1, 0),
  },
  {
    position: VectorF(-20, 0),
    velocityNormalized: VectorF(0.5, 0),
    accNormalized: VectorF(1, 0),
  },
  {
    position: VectorF(0, 0),
    velocityNormalized: VectorF(1, 0),
    accNormalized: VectorFZero,
  },
  {
    position: VectorF(20, 0),
    velocityNormalized: VectorF(0.5, 0),
    accNormalized: VectorF(-1, 0),
  },
  {
    position: VectorF(40, 0),
    velocityNormalized: VectorF(0.25, 0),
    accNormalized: VectorF(-1, 0),
  },
  {
    position: VectorF(50, 0),
    velocityNormalized: VectorFZero,
    accNormalized: VectorFZero,
  },
];
StartAndStop.args = {
  items: startAndStopTrajectory,
};

// noinspection JSUnusedGlobalSymbols
const oneToOne = {
  control: {
    type: 'range',
    min: -1.0,
    max: 1.0,
    step: 0.1,
  },
};
export default {
  title: 'Three/Trajectory',
  component: ThreeTrajectoryItem,
  argTypes: {
    velX: oneToOne,
    velY: oneToOne,
    accX: oneToOne,
    accY: oneToOne,
  },
} as Meta;
