import React, { Suspense, useEffect, useState } from 'react';
import { Story, Meta } from '@storybook/react';
import * as uuid from 'uuid';
import { Canvas } from 'react-three-fiber';
import { Vector3 } from 'three';
import { CAMERA_DEFAULT_ZOOM, CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { PlanetTextureShaderShape } from './PlanetTextureShaderShape';

export default {
  title: 'Example/PlanetTextureShaderShape',
  component: PlanetTextureShaderShape
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
          <PlanetTextureShaderShape key={revision + JSON.stringify(args)} color={args.color} seed={args.seed} />
        </group>
    </Canvas>
  );
};

export const Main = Template.bind({});
Main.args = {
  color: "#ff00ff",
  seed: "123"
};
