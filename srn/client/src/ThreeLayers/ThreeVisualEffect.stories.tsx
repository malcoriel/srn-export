import React, { useState } from 'react';
import { Story, Meta } from '@storybook/react';
import { ThreeVisualEffect, ThreeVisualEffectProps } from './ThreeVisualEffect';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { LocalEffect, LocalEffectDmgDone } from '../../../world/pkg/world';
import { VectorFzero } from '../utils/Vector';

const effects: Record<string, any> = {
  DmgDone: {
    tag: 'DmgDone',
    hp: 100,
    key: '1',
    last_tick: 0,
    position: VectorFzero,
  } as LocalEffectDmgDone,
};
export default {
  title: 'Three/ThreeVisualEffect',
  component: ThreeVisualEffect,
  argTypes: {
    effect: {
      control: {
        type: 'select',
        options: Object.keys(effects),
      },
    },
  },
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(0);
  return (
    <div>
      <StoryCanvas withBackground withRuler zoom={10.0}>
        <ThreeVisualEffect
          key={JSON.stringify(args) + revision}
          effect={effects[args.effect]}
        />
      </StoryCanvas>
      {/* eslint-disable-next-line react/button-has-type */}
      <button onClick={() => setRevision(revision + 1)}>trigger</button>
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  effect: 'DmgDone',
};
