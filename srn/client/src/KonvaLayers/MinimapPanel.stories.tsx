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
import { ObjectSpecifier } from '../../../world/pkg/world';
import { IVector } from '../utils/Vector';

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
const makePlanet = (
  id: string,
  radius: number,
  pos: IVector,
  anchor: ObjectSpecifier,
  color: string,
  rotation_sign = 1,
  anchor_tier = 1
): PlanetV2 => ({
  id,
  color,
  health: null,
  name: id,
  properties: [],
  movement: MovementBuilder.MovementRadialMonotonous({
    full_period_ticks: 1000000 * rotation_sign,
    relative_position: {
      x: 0,
      y: 0,
    },
    phase: 0,
    start_phase: 0,
    anchor,
  }),
  rot_movement: RotationMovementBuilder.RotationMovementNone(),
  anchor_tier,
  spatial: {
    position: pos,
    radius,
    rotation_rad: 0,
  },
});

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
    makePlanet(
      '1',
      20,
      {
        x: 100,
        y: 100,
      },
      {
        tag: 'Star' as const,
        id: '0',
      },
      'blue'
    ),
    makePlanet(
      '2',
      20,
      {
        x: -100,
        y: 130,
      },
      {
        tag: 'Star' as const,
        id: '0',
      },
      'yellow',
      -1
    ),
    makePlanet(
      '2',
      20,
      {
        x: -150,
        y: -150,
      },
      {
        tag: 'Star' as const,
        id: '0',
      },
      'green'
    ),
    makePlanet(
      '2',
      20,
      {
        x: 120,
        y: -120,
      },
      {
        tag: 'Star' as const,
        id: '0',
      },
      'pink',
      -1
    ),
  ],
};

export default {
  title: 'UI/MinimapPanel',
  component: MinimapPanel,
  argTypes: {},
} as Meta;
