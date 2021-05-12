// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { NotificationPanel } from './NotifcationPanel';
import { gray, teal } from '../utils/palette';
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
        background: gray,
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
      id: '1',
      text: {
        text: 'test help notification',
        substitutions: [],
      },
    }),
    NotificationBuilder.NotificationTask({
      id: '2',
      text: {
        text: 'New task',
        substitutions: [],
      },
    }),
    NotificationBuilder.NotificationHelp({
      id: '3',
      text: {
        text: 'test help notification 2',
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
