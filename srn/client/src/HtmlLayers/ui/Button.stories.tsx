import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { Button } from './Button';
import { gray } from '../../utils/palette';
import { useInterval } from 'usehooks-ts';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const [cooldown, setCooldown] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

  useInterval(
    () => {
      const newVal = cooldown - 0.1;
      setCooldown(newVal);
      if (newVal <= 0) {
        setIsCountingDown(false);
      }
    },
    isCountingDown ? 100 : null
  );

  return (
    <div key={`${revision}+${JSON.stringify(args)}`}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: gray,
          alignItems: 'center',
          width: 200,
          height: 200,
        }}
      >
        <Button
          onClick={() => {
            if (!args.controlledCooldown) {
              setCooldown(1);
              setIsCountingDown(true);
            }
          }}
          forceHotkeyAsHint
          text={args.text}
          hotkey={args.hotkey}
          cooldownNormalized={
            args.controlledCooldown ? args.cooldownNormalized : cooldown
          }
          cooldownAreaWidth={68}
          cooldownAreaHeight={45}
        />
      </div>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  text: 'qq',
  hotkey: '1',
  controlledCooldown: false,
  cooldownNormalized: 0.0,
};

export const ControlledCooldown = Template.bind({});
ControlledCooldown.args = {
  text: 'qq',
  hotkey: '1',
  controlledCooldown: true,
  cooldownNormalized: 0.7,
};

export default {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    cooldownNormalized: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.01,
      },
    },
  },
} as Meta;
