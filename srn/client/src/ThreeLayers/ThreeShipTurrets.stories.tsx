import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShipTurrets } from './ThreeShipTurrets';
import Vector from '../utils/Vector';
import _ from 'lodash';
import { cycle } from '../utils/cycle';
import {
  genLongActions,
  genTurrets,
  ShootMode,
  shootTargets,
} from './TurretStoriesHelpers';

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

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  // @ts-ignore
  const target: Vector = shootTargets[args.shootTarget];
  const [progressNormalized, setProgressNormalized] = useState(
    args.progressNormalized
  );
  useEffect(() => {
    const int = setInterval(() => {
      if (args.autoPlay) {
        setProgressNormalized((old: number) => {
          const val = old + 0.05;
          return cycle(val, 0, 1);
        });
      }
    }, 100);
    return () => clearInterval(int);
  }, [args.autoPlay, setProgressNormalized]);
  const longActions = genLongActions(args.shootMode, progressNormalized * 100);

  return (
    <StoryCanvas withBackground zoom={15.0}>
      <ThreeShipTurrets
        beamWidth={0.2}
        turrets={genTurrets(4)}
        rotation={args.rotation}
        positionRadius={2.0}
        color="red"
        key={(() => {
          const patchedArgs = _.cloneDeep(args);
          delete patchedArgs.shootTarget;
          delete patchedArgs.progressNormalized;
          return JSON.stringify(patchedArgs) + revision;
        })()}
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
