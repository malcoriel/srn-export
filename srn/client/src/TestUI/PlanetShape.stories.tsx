import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import Vector from '../utils/Vector';
import { gasGiantShaderRandomProps } from '../ThreeLayers/shaders/gasGiant';
import { possibleGasGiantColors } from '../ThreeLayers/Resources';

// noinspection JSUnusedGlobalSymbols
export default {
  title: 'Three/PlanetShape',
  component: ThreePlanetShape,
  argTypes: {
    color: {
      options: possibleGasGiantColors,
      control: {
        type: 'select',
      },
    },
    atmospherePercent: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.025,
      },
    },
  },
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const radius = 200;
  const id = 'id';
  return (
    <div>
      <StoryCanvas>
        <mesh position={[0, 0, -10]}>
          <planeBufferGeometry args={[256, 256]} />
          <meshBasicMaterial color="#333" />
        </mesh>
        <ThreePlanetShape
          gid="1"
          radius={radius}
          {...gasGiantShaderRandomProps(id, radius)}
          onClick={(_: MouseEvent) => {}}
          position={new Vector(0, 0)}
          key={revision + JSON.stringify(args)}
          color={args.color}
          atmosphereColor={args.atmosphereColor}
          atmospherePercent={args.atmospherePercent}
          visible
        />
      </StoryCanvas>
    </div>
  );
};

export const GasGiant = Template.bind({});
GasGiant.args = {
  color: '#008FA9',
  atmospherePercent: 0.15,
  atmosphereColor: '#008FA9',
};
