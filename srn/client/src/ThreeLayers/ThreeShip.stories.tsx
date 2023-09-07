import { StoryCanvas } from '../TestUI/StoryCanvas';
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { ThreeShip } from './ThreeShip';
import Vector, { VectorF, VectorFzero } from '../utils/Vector';
import { InteractorMap } from './InteractorMap';
import { ThreeShipWreck } from './ThreeShipWreck';
import {
  genLongActions,
  genTurrets,
  ShootMode,
  shootTargets,
} from './TurretStoriesHelpers';
import { cycle } from '../utils/cycle';

export default {
  title: 'Three/Ship',
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
    turretCount: {
      control: {
        type: 'range',
        min: 0,
        max: 4,
        step: 1,
      },
    },
  },
} as Meta;

const MainTemplate: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);

  const target: Vector = shootTargets.top;
  const [progressNormalized, setProgressNormalized] = useState(0);
  useEffect(() => {
    const int = setInterval(() => {
      setProgressNormalized((old: number) => {
        const val = old + 0.05;
        return cycle(val, 0, 1);
      });
    }, 100);
    return () => clearInterval(int);
  }, [args.autoPlay, setProgressNormalized]);
  const longActions = genLongActions(
    ShootMode.Simultaneous,
    progressNormalized * 100
  );

  return (
    <StoryCanvas withBackground zoom={15.0}>
      {!args.blow ? (
        <ThreeShip
          key={revision + JSON.stringify(args)}
          color="red"
          gid="1"
          hpNormalized={args.hpNormalized}
          position={VectorF(-4, 5)}
          interactor={InteractorMap.ship({})}
          radius={2.0}
          opacity={1.0}
          rotation={args.rotation}
          visible
          tractorTargetPosition={args.tractoring ? VectorF(-5, -5) : null}
          longActions={args.shooting ? longActions : []}
          turrets={genTurrets(args.turretCount)}
          findObjectPositionByIdBound={() => target}
          markers={null}
          velocity={VectorFzero}
        />
      ) : (
        <ThreeShipWreck
          key={revision + JSON.stringify(args)}
          color="red"
          gid="11231231231232"
          radius={2.0}
          opacity={1.0}
          fadeOver={3 * 1e6}
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
  shooting: true,
  turretCount: 3,
  rotation: 0.0,
};
