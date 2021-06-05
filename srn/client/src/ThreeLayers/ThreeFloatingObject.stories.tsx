// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import { rare } from '../utils/palette';
import { InteractorActionType } from './blocks/ThreeInteractor';
import _ from 'lodash';
import { GlobalContextMenu } from '../HtmlLayers/GlobalContextMenu';

export default {
  title: 'Three/ThreeFloatingObject',
  component: ThreeFloatingObject,
  argTypes: {},
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const [isSelected, setSelected] = useState(false);
  const spySetSelected = (val: boolean) => {
    console.log('set selected', val);
    setSelected(val);
  };
  const interactorProps = {
    actions: args.actions,
    hint: args.hint,
    outlineThickness: args.outlineThickness,
    outlineColor: args.outlineColor,
    isSelected,
    onReportSelected: (_id: string, val: boolean) => spySetSelected(val),
  };
  return (
    <div>
      <StoryCanvas>
        <ThreeSpaceBackground
          size={256}
          shift={0}
          onClick={() => spySetSelected(false)}
        />
        <ThreeFloatingObject
          modelName={args.modelName}
          radius={40}
          gid="1"
          position={[0, 0, 10]}
          colors={args.colors}
          meshes={args.meshes}
          scale={args.scale}
          key={revision + JSON.stringify(args)}
          interactor={args.actions ? interactorProps : undefined}
        />
      </StoryCanvas>
      <GlobalContextMenu />
    </div>
  );
};

export const Container = Template.bind({});
Container.args = {
  meshes: ['0.children.0', '0.children.1', '0.children.2'],
  modelName: 'container.glb',
  scale: 0.002,
};
export const ContainerWithActions = Template.bind({});
ContainerWithActions.args = {
  ...Container.args,
  actions: new Map([
    [InteractorActionType.Select, _.partial(console.log, 'select')],
    [InteractorActionType.Tractor, _.partial(console.log, 'tractor')],
  ]),
  outlineThickness: 2,
  outlineColor: 'green',
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
