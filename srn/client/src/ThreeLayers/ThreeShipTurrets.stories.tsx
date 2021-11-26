import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShipTurrets } from './ThreeShipTurrets';
import Vector, { VectorF } from '../utils/Vector';

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
    shootTarget: {
      options: ['top', 'right', 'bottomRight', 'topRight', 'topLeft'],
      control: {
        type: 'select',
      },
    },
  },
} as Meta;

const targets = {
  top: VectorF(0.0, 5),
  right: VectorF(5, 0.0),
  bottomRight: VectorF(6, -4),
  topRight: VectorF(6, 4),
  topLeft: VectorF(-6, 4),
};

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  // @ts-ignore
  const target: Vector = targets[args.shootTarget];
  return (
    <StoryCanvas withBackground zoom={15.0}>
      <ThreeShipTurrets
        shootTarget={target}
        beamWidth={0.2}
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
  shootTarget: 'top',
};
