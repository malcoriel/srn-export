import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StyledRect } from './StyledRect';
import { gray } from '../../utils/palette';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
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
          width: 500,
          height: 500,
        }}
      >
        <StyledRect
          width={200}
          height={50}
          line="thin"
          thickness={10}
          autoHeight={args.autoHeight}
          autoWidth={args.autoWidth}
        >
          {args.content}
        </StyledRect>
      </div>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  content: 'Content',
};

export const LongContentAutoHeight = Template.bind({});
LongContentAutoHeight.args = {
  content:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  autoHeight: true,
};

export const LongContentAutoWidth = Template.bind({});
LongContentAutoWidth.args = {
  content:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  autoWidth: true,
};

export default {
  title: 'UI/StyledRect',
  component: StyledRect,
  argTypes: {},
} as Meta;
