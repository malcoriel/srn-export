// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { NotificationPanel } from './NotifcationPanel';
import { teal } from '../utils/palette';
import { NotificationBuilder } from '../../../world/pkg/world.extra';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div
      key={`${revision}+${JSON.stringify(args)}`}
      style={{
        background: teal,
        position: 'absolute',
        width: 500,
        height: 500,
      }}
    >
      <div style={{ position: 'absolute', width: '100%', bottom: 0 }}>
        <NotificationPanel notifications={args.notifications} />
      </div>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  notifications: [
    NotificationBuilder.NotificationHelp({
      text: {
        text: 'test help notification',
        substitutions: [],
      },
    }),
    NotificationBuilder.NotificationUnknown(),
  ],
};

export default {
  title: 'UI/NotificationPanel',
  component: NotificationPanel,
  argTypes: {},
} as Meta;
