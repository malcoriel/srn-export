import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { PlanetTextureShape } from './PlanetTextureShape';
import { StoryCanvas } from './StoryCanvas';
import { ThreeStar } from '../ThreeLayers/ThreeStar';
import _ from 'lodash';
import { posToThreePos } from '../ThreeLayers/ThreeLayer';
import Vector from '../utils/Vector';

export default {
  title: 'Three/StarShape',
  component: PlanetTextureShape,
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
            zoomShift: 1,
            cameraPosition: new Vector(0, 0),
          }}
          visible
          scale={_.times(3, () => 128) as [number, number, number]}
          position={posToThreePos(0, 0)}
          color={args.color}
        />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  color: 'rgb(200, 150, 65)',
};
