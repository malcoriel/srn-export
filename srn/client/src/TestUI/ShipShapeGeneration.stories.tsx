import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import {
  ShipShapeGeneration,
  ThreeInterceptorOutline,
  ThreeTriangle,
} from './ShipShapeGeneration';
import { VectorF } from '../utils/Vector';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas scale={2.0} withRuler>
        <ThreeSpaceBackground
          key={`${revision}+${JSON.stringify(args)}`}
          shaderShift={args.shift}
          size={512}
        />
        <ThreeTriangle
          sideSize={64}
          position={VectorF(0, 0)}
          rotationRad={args.rotationRad}
          color="red"
        />
        <ThreeInterceptorOutline />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  rotationRad: 0.0,
};

export default {
  title: 'Three/ShipShapeGeneration',
  component: ShipShapeGeneration,
  argTypes: {
    rotationRad: {
      control: {
        type: 'range',
        min: 0.0,
        max: Math.PI / 2,
        step: 0.1,
      },
    },
  },
} as Meta;
