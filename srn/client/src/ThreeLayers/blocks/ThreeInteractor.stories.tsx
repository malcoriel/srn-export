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
  const renderInteractable = ({
    id,
    position,
  }: {
    id: string;
    position: Vector3Arr;
  }) => (
    <group position={position} key={id}>
      <mesh position={[0, 0, 0]}>
        <circleBufferGeometry args={[10, 10]} />
        <meshBasicMaterial color="teal" />
      </mesh>
      <ThreeInteractor
        radius={15}
        objectId={id}
        perfId={id}
        interactor={{
          defaultAction: InteractorActionType.Tractor,
          outlineThickness: 1,
        }}
      />
    </group>
  );

  return (
    <div>
      <StoryCanvas>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <group key={revision}>
          {args.neutral.map((n: any) => renderInteractable(n))}
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
    { id: '1', position: [-30, -30, 10] },
    { id: '2', position: [30, 30, 10] },
  ],
  hostile: [],
};
