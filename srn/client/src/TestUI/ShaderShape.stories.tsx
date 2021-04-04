import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { Canvas } from 'react-three-fiber';
import { CanvasTexture, Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { PlanetTextureShaderShape } from './PlanetTextureShaderShape';
import { ThreePlanetShape, ThreePlanetShapeRandomProps } from '../ThreeLayers/ThreePlanetShape';
import Vector from '../utils/Vector';

export default {
  title: 'Example/PlanetTextureShaderShape',
  component: PlanetTextureShaderShape,
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const [delay, setDelay] = useState(false);
  useEffect(() => {
    setTimeout(() => setDelay(true), 0);
  }, []);
  const texture = useMemo(() => {
    const canvas = document.querySelectorAll('canvas')[0];
    return new CanvasTexture(canvas);
  }, [delay, args]);
  return (
    <div>
      <Canvas
        orthographic
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: new Vector3(0, 0, CAMERA_HEIGHT),
          zoom: 1.0,
          far: 1000,
        }}
        style={{
          width: 256,
          height: 256,
        }}
      >
        <ambientLight />
        <pointLight position={[0, 0, CAMERA_HEIGHT]} />
        <group position={[0, 0, 0]}>
          <PlanetTextureShaderShape key={revision + JSON.stringify(args)} color={args.color} seed={args.seed} />
        </group>
      </Canvas>
      <Canvas
        orthographic
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: new Vector3(0, 0, CAMERA_HEIGHT),
          zoom: 1.0,
          far: 1000,
        }}
        style={{
          width: 256,
          height: 256,
        }}
      >
        <Suspense fallback={<mesh />}>
          <ambientLight />
          <pointLight position={[0, 0, CAMERA_HEIGHT]} />
          <ThreePlanetShape
            {...ThreePlanetShapeRandomProps(args.seed, 256)}
            texture={texture} position={new Vector(0, 0)} radius={256}
            visible />
        </Suspense>
      </Canvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  color: '#ff00ff',
  seed: '123',
};
