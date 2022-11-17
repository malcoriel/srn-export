import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import { ThreeStar } from '../ThreeLayers/ThreeStar';
import _ from 'lodash';
import Vector from '../utils/Vector';
import { posToThreePos } from '../ThreeLayers/util';

export default {
  title: 'Three/StarShape',
  component: ThreeStar,
  argTypes: {},
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas>
        <mesh position={[0, 0, -10]}>
          <planeBufferGeometry args={[256, 256]} />
          <meshBasicMaterial color="teal" />
        </mesh>
        <ThreeStar
          key={revision + JSON.stringify(args)}
          visualState={{
            boundCameraMovement: false,
            targetZoomShift: 1,
            currentZoomShift: 1,
            cameraPosition: new Vector(0, 0),
            breadcrumbs: [],
          }}
          visible
          scale={_.times(3, () => 128) as [number, number, number]}
          position={posToThreePos(0, 0)}
          color={args.color}
          coronaColor={args.coronaColor}
        />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  color: 'rgb(200, 150, 65)',
  coronaColor: 'rgb(200, 150, 65)',
};
