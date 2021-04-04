import React, { Suspense, useEffect, useState } from 'react';
import { Story, Meta } from '@storybook/react';
import { ShaderShape } from './ShaderTestUI';
import * as uuid from 'uuid';
import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import { CAMERA_DEFAULT_ZOOM, CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';

export default {
  title: 'Example/ShaderShape',
  component: ShaderShape
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <Canvas
      orthographic
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: CAMERA_DEFAULT_ZOOM(),
        far: 1000,
      }}
      style={{
        position: 'absolute',
        width: '90%',
        height: '90%'
      }}
    >
        <ambientLight />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <group position={[0, 0, 0]}>
          <ShaderShape key={revision} {...args} />
        </group>
    </Canvas>
  );
};

export const Primary = Template.bind({});
Primary.args = {
};
