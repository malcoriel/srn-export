import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { gray } from '../utils/palette';
import { MinimapPanel } from './MinimapPanel';
import NetState from '../NetState';
import { PlanetV2, Star } from '../world';
import {
  MovementBuilder,
  RotationMovementBuilder,
} from '../../../world/pkg/world.extra';

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    const ns = NetState.make();
    ns.state.locations[0].star = args.star;
    ns.state.locations[0].planets = args.planets;
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
      <MinimapPanel />
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  star: {
    id: '0',
    name: '0',
    color: 'red',
    corona_color: 'red',
    spatial: { position: { x: 0, y: 0 }, radius: 50, rotation_rad: 0 },
    movement: MovementBuilder.MovementNone(),
    rot_movement: RotationMovementBuilder.RotationMovementNone(),
  } as Star,
  planets: [
    {
      id: '1',
      name: '1',
      movement: MovementBuilder.MovementRadialMonotonous({
        full_period_ticks: 1000,
        relative_position: {
          x: 0,
          y: 0,
        },
        phase: 0,
        start_phase: 0,
        anchor: {
          tag: 'Star',
          id: '0',
        },
      }),
      spatial: {
        position: {
          x: 100,
          y: 100,
        },
        radius: 10,
        rotation_rad: 0,
      },
    } as PlanetV2,
  ],
};

export default {
  title: 'UI/MinimapPanel',
  component: MinimapPanel,
  argTypes: {},
} as Meta;
