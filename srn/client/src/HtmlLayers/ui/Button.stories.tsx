import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import { Button } from './Button';
import { gray } from '../../utils/palette';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
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
        <Button text={args.text} hotkey={args.hotkey} />
      </div>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  text: 'qq',
  hotkey: 'w',
};

export default {
  title: 'UI/Button',
  component: Button,
  argTypes: {},
} as Meta;
