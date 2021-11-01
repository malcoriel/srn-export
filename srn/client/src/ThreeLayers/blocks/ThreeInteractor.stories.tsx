// @ts-ignore
import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from '../ThreeSpaceBackground';
import { InteractorActionType, ThreeInteractor } from './ThreeInteractor';
import { Vector3Arr } from '../util';
import { resetStore, store } from '../../store';
import { ObjectSpecifierBuilder } from '../../../../world/pkg/world.extra';
import _ from 'lodash';

export default {
  title: 'Three/ThreeInteractor',
  component: ThreeInteractor,
  argTypes: {},
} as Meta;

const Template: Story = (args) => {
  setTimeout(() => {
    resetStore();
    if (args.storeState) {
      store.setState(args.storeState);
    }
  });
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const renderInteractable = (
    {
      id,
      position,
    }: {
      id: string;
      position: Vector3Arr;
    },
    hostile: boolean
  ) => {
    const color = hostile ? 'red' : 'teal';
    return (
      <group position={position} key={id}>
        <mesh position={[0, 0, 0]}>
          <circleBufferGeometry args={[1, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <ThreeInteractor
          radius={1.5}
          objectId={id}
          perfId={id}
          interactor={{
            hostile,
            defaultAction: hostile
              ? InteractorActionType.Shoot
              : InteractorActionType.Tractor,
            outlineColor: color,
          }}
        />
      </group>
    );
  };

  return (
    <div>
      {/* interactor text for some reason depends on the camera zoom, probably some bug or lack of compensation in Text elem */}
      <StoryCanvas zoom={10.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <group key={revision}>
          {args.neutral.map((n: any) => renderInteractable(n, false))}
          {args.hostile.map((n: any) => renderInteractable(n, true))}
        </group>
      </StoryCanvas>
    </div>
  );
};

export const SingleNeutral = Template.bind({});
SingleNeutral.args = {
  neutral: [{ id: '1', position: [0, 0, 10] }],
  hostile: [],
};

export const SingleHostile = Template.bind({});
SingleHostile.args = {
  neutral: [],
  hostile: [{ id: '1', position: [0, 0, 10] }],
};

export const SingleHostileAutofocused = Template.bind({});
SingleHostileAutofocused.args = {
  neutral: [],
  hostile: [{ id: '1', position: [0, 0, 10] }],
  storeState: {
    hostileAutoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierShip({
      id: '1',
    }),
  },
};

export const SingleNeutralAutofocused = Template.bind({});
SingleNeutralAutofocused.args = {
  ...SingleNeutral.args,
  storeState: {
    autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
      id: '1',
    }),
  },
};

export const DoubleNeutral = Template.bind({});
DoubleNeutral.args = {
  neutral: [
    { id: '1', position: [-3, -3, 10] },
    { id: '2', position: [3, 3, 10] },
  ],
  hostile: [],
};

export const DoubleNeutralWithAutofocus = Template.bind({});
DoubleNeutralWithAutofocus.args = {
  ..._.cloneDeep(DoubleNeutral.args),
  storeState: {
    autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
      id: '1',
    }),
  },
};

export const HostileAndNeutralWithoutAutofocus = Template.bind({});
HostileAndNeutralWithoutAutofocus.args = {
  neutral: [{ id: '1', position: [-3, -3, 10] }],
  hostile: [{ id: '2', position: [3, 3, 10] }],
};

export const HostileAndNeutralWithNeutralAutofocus = Template.bind({});
HostileAndNeutralWithNeutralAutofocus.args = {
  ...HostileAndNeutralWithoutAutofocus.args,
  storeState: {
    autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierMineral({
      id: '1',
    }),
  },
};

export const HostileAndNeutralWithHostileAutofocus = Template.bind({});
HostileAndNeutralWithHostileAutofocus.args = {
  ...HostileAndNeutralWithoutAutofocus.args,
  storeState: {
    autoFocusSpecifier: ObjectSpecifierBuilder.ObjectSpecifierShip({
      id: '2',
    }),
  },
};
