import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShip, ThreeShipWreck } from './ThreeShip';
import { VectorF } from '../utils/Vector';
import { InteractorMap } from './InteractorMap';

export default {
  title: 'Three/Ship',
  component: ThreeShip,
  argTypes: {
    hpNormalized: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.1,
      },
    },
    rotation: {
      control: {
        type: 'range',
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
    },
  },
} as Meta;

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <StoryCanvas withBackground zoom={15.0}>
      {!args.blow ? (
        <ThreeShip
          key={revision + JSON.stringify(args)}
          color="red"
          gid="1"
          hpNormalized={args.hpNormalized}
          position={VectorF(0, 0)}
          interactor={InteractorMap.ship({})}
          radius={2.0}
          opacity={1.0}
          rotation={args.rotation}
          visible
          tractorTargetPosition={args.tractoring ? VectorF(25, 25) : null}
        />
      ) : (
        <ThreeShipWreck
          key={revision + JSON.stringify(args)}
          color="red"
          gid="11231231231232"
          radius={2.0}
          opacity={1.0}
          rotation={args.rotation}
          position={VectorF(0, 0)}
        />
      )}
    </StoryCanvas>
  );
};

export const Main = MainTemplate.bind({});
Main.args = {
  blow: false,
  hpNormalized: 1.0,
  tractoring: false,
  rotation: 0.0,
};
