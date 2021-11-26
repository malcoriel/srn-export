import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShipTurrets } from './ThreeShipTurrets';
import Vector, { VectorF } from '../utils/Vector';
import _ from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import { LongActionBuilder } from '../../../world/pkg/world.extra';

enum ShootMode {
  Simultaneous,
  PartialSimultaneous,
}

export default {
  title: 'Three/ShipTurrets',
  component: ThreeShipTurrets,
  argTypes: {
    rotation: {
      control: {
        type: 'range',
        min: -Math.PI,
        max: Math.PI,
        step: 0.01,
      },
    },
    progressNormalized: {
      control: {
        type: 'range',
        min: 0,
        max: 1.0,
        step: 0.01,
      },
    },
    shootTarget: {
      options: ['top', 'right', 'bottomRight', 'topRight', 'topLeft'],
      control: {
        type: 'select',
      },
    },
    shootMode: {
      options: Object.values(ShootMode).filter((v) => !_.isNaN(Number(v))),
      control: {
        type: 'select',
        labels: Object.values(ShootMode).filter((v) => _.isNaN(Number(v))),
      },
    },
  },
} as Meta;

const targets = {
  top: VectorF(0.0, 5),
  right: VectorF(5, 0.0),
  bottomRight: VectorF(6, -4),
  topRight: VectorF(6, 4),
  topLeft: VectorF(-6, 4),
};

function genLongAct(percentage: number, turretId: string) {
  const longActionShoot = LongActionBuilder.LongActionShoot({
    id: '1',
    micro_left: 500,
    percentage,
    target: '1',
  });
  longActionShoot.turretId = turretId;
  return longActionShoot;
}

const genLongActions = (shootMode: ShootMode, percentage: number) => {
  switch (shootMode) {
    case ShootMode.PartialSimultaneous:
      return [genLongAct(percentage, '1'), genLongAct(percentage, '3')];
    case ShootMode.Simultaneous:
      return [
        genLongAct(percentage, '1'),
        genLongAct(percentage, '2'),
        genLongAct(percentage, '3'),
        genLongAct(percentage, '4'),
      ];
    default:
      throw new UnreachableCaseError(shootMode);
  }
};

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  // @ts-ignore
  const target: Vector = targets[args.shootTarget];
  const [progressNormalized, setProgressNormalized] = useState(
    args.progressNormalized
  );
  useEffect(() => {
    const int = setInterval(() => {
      if (args.autoPlay) {
        setProgressNormalized((old: number) => {
          const val = old + 0.05;
          // console.log(val);
          if (val > 1.0) {
            return 0.0;
          }
          return val;
        });
      }
    }, 100);
    return () => clearInterval(int);
  }, [args.autoPlay, setProgressNormalized]);
  const longActions = genLongActions(args.shootMode, progressNormalized * 100);

  return (
    <StoryCanvas withBackground zoom={15.0}>
      <ThreeShipTurrets
        shootTarget={target}
        beamWidth={0.2}
        turretIds={['1', '2', '3', '4']}
        rotation={args.rotation}
        radius={2.0}
        color="red"
        key={JSON.stringify(args) + revision}
        findObjectPositionByIdBound={() => target}
        longActions={longActions}
      />
    </StoryCanvas>
  );
};

export const Main = MainTemplate.bind({});
Main.args = {
  rotation: 0.0,
  shootTarget: 'top',
  shootMode: ShootMode.Simultaneous,
  progressNormalized: 0.5,
  autoPlay: false,
};
