import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { NotificationPanel } from './NotifcationPanel';
import { gray } from '../utils/palette';
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
        height: 300,
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
      header: 'help 1',
      text: {
        text: 'test help notification',
        substitutions: [],
      },
    }),
    NotificationBuilder.NotificationTask({
      id: '2',
      header: 'New task',
      text: {
        text:
          'Soooooo long description\nSoooooo long description Soooooo long description',
        substitutions: [],
      },
    }),
    NotificationBuilder.NotificationHelp({
      id: '3',
      header: 'help 2',
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
