import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { gray } from '../utils/palette';
import { ActionsBar } from './ActionsBar';
import { FaBullseye } from 'react-icons/all';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div
      key={`${revision}+${JSON.stringify(args)}`}
      style={{
        background: gray,
        position: 'absolute',
        width: 500,
        height: 300,
      }}
    >
      <div style={{ position: 'absolute', width: '100%', bottom: 0 }}>
        <ActionsBar
          indexByNumbers={args.indexByNumbers}
          actions={[
            {
              text: 'qq',
              action: () => console.log('qq'),
              hotkey: 'q',
            },
            {
              icon: <FaBullseye size={20} />,
              action: () => console.log('icon'),
              hotkey: 'i',
            },
            {
              text: 'ww',
              action: () => console.log('ww'),
              hotkey: 'w',
            },
          ]}
        />
      </div>
    </div>
  );
};

export const ByNumbers = Template.bind({});
ByNumbers.args = {
  indexByNumbers: true,
};

export const ByHotkeys = Template.bind({});
ByHotkeys.args = {};

export default {
  title: 'UI/ActionsBar',
  component: ActionsBar,
  argTypes: {},
} as Meta;
