import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ReplayPlayerControls } from './ReplayPlayerControls';
import { gray } from '../../utils/palette';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const [value, setValue] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (playing) {
      const int = setInterval(() => setValue(value + 10), 100);
      return () => clearInterval(int);
    }
    return () => {};
  }, [playing, value, setValue]);
  return (
    <div
      key={`${revision}+${JSON.stringify(args)}`}
      style={{
        background: gray,
        width: 1000,
        height: 100,
      }}
    >
      <div style={{ width: 1000, bottom: 0 }}>
        <ReplayPlayerControls
          maxTimeMs={1000}
          value={value}
          onChange={setValue}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playing={playing}
          marks={[
            {
              id: 1,
              timeMs: 500,
            },
            {
              id: 2,
              timeMs: 250,
            },
            {
              id: 3,
              timeMs: 0,
            },
            {
              id: 4,
              timeMs: 1000,
            },
          ]}
        />
      </div>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {};

export default {
  title: 'UI/ReplayPlayerControls',
  component: ReplayPlayerControls,
  argTypes: {},
} as Meta;
