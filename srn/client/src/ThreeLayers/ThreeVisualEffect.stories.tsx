import React, { useEffect, useState } from 'react';
import { Story, Meta } from '@storybook/react';
import { ThreeVisualEffect, ThreeVisualEffectProps } from './ThreeVisualEffect';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { LocalEffectDmgDone } from '../../../world/pkg/world';
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
  const [revision, _setRevision] = useState(0);
  const [numericValue, setNumericValue] = useState(args.numericValue);
  const [textValue, setTextValue] = useState(args.textValue);
  useEffect(() => {
    setNumericValue(args.numericValue);
  }, [args.numericValue]);
  useEffect(() => {
    setTextValue(args.textValue);
  }, [args.textValue]);
  const keyValue =
    args.effect +
    revision +
    args.textMode +
    args.numericValue +
    args.textValue +
    args.effectTimeSeconds +
    args.textEffectTimeSeconds;
  return (
    <div>
      <StoryCanvas withBackground withRuler zoom={10.0}>
        <ThreeVisualEffect
          key={keyValue}
          effect={{
            ...effects[args.effect],
            hp: args.textMode ? undefined : numericValue,
            text: args.textMode ? textValue : undefined,
          }}
          effectTimeSeconds={args.effectTimeSeconds}
          textEffectTimeSeconds={args.textEffectTimeSeconds}
        />
      </StoryCanvas>
      {/* eslint-disable-next-line react/button-has-type */}
      <button
        onClick={() => {
          if (!args.textMode) {
            setNumericValue(numericValue + 100);
          } else {
            setTextValue(
              textValue === args.textValue ? 'qweqweqwe' : args.textValue
            );
          }
        }}
      >
        trigger
      </button>
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  effect: 'DmgDone',
  numericValue: 100,
  effectTimeSeconds: 3,
  textEffectTimeSeconds: 0.25,
  textValue: 'abc',
  textMode: false,
};
