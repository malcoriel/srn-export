// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeFloatingObject2 } from './ThreeFloatingObject2';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { rare } from '../utils/palette';

export default {
  title: 'Three/ThreeFloatingObject2',
  component: ThreeFloatingObject2,
  argTypes: {},
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas>
        <ThreeSpaceBackground size={256} shift={0} />
        <ThreeFloatingObject2
          modelName={args.modelName}
          radius={40}
          gid="1"
          position={[0, 0, 10]}
          colors={args.colors}
          meshes={args.meshes}
          scale={args.scale}
          key={revision + JSON.stringify(args)}
        />
      </StoryCanvas>
    </div>
  );
};

export const Container = Template.bind({});
Container.args = {
  meshes: ['0.children.0', '0.children.1', '0.children.2'],
  modelName: 'container.glb',
  scale: 0.002,
};

export const Asteroid = Template.bind({});
Asteroid.args = {
  meshes: ['2'],
  modelName: 'asteroid.glb',
  scale: 0.2,
};

export const ColoredAsteroid = Template.bind({});
ColoredAsteroid.args = {
  meshes: ['2'],
  modelName: 'asteroid.glb',
  scale: 0.2,
  colors: [rare],
};
