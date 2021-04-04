import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { Canvas } from 'react-three-fiber';
import { CanvasTexture, Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { PlanetTextureShaderShape } from './PlanetTextureShaderShape';
import {
  ThreePlanetShape,
  ThreePlanetShapeRandomProps,
} from '../ThreeLayers/ThreePlanetShape';
import Vector from '../utils/Vector';
import { TextureMixerShaderShape } from './TextureMixerShaderShape';

export default {
  title: 'Example/PlanetTextureShaderShape',
  component: PlanetTextureShaderShape,
} as Meta;

const StoryCanvas: React.FC = ({ children }) => {
  return (
    <Canvas
      orthographic
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        position: new Vector3(0, 0, CAMERA_HEIGHT),
        zoom: 1.0,
        far: 1000,
      }}
      style={{
        display: 'inline-block',
        width: 256,
        height: 256,
      }}
    >
      <ambientLight />
      <pointLight position={[0, 0, CAMERA_HEIGHT]} />
      <group position={[0, 0, 0]}>{children}</group>
    </Canvas>
  );
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const [delay, setDelay] = useState(0);
  useEffect(() => {
    setTimeout(() => setDelay((d) => d + 1), 0);
    setTimeout(() => setDelay((d) => d + 2), 100);
  }, []);
  const { texture1, texture2, texture3, textureMixed } = useMemo(() => {
    const canvases = document.querySelectorAll('canvas');
    return {
      texture1: new CanvasTexture(canvases[0]),
      texture2: new CanvasTexture(canvases[1]),
      texture3: new CanvasTexture(canvases[2]),
      textureMixed: new CanvasTexture(canvases[3]),
    };
  }, [delay, args]);
  return (
    <div>
      <StoryCanvas>
        <PlanetTextureShaderShape
          key={revision + JSON.stringify(args)}
          color={args.color1}
          seed={args.seed}
        />
      </StoryCanvas>
      <StoryCanvas>
        <PlanetTextureShaderShape
          key={revision + JSON.stringify(args)}
          color={args.color2}
          seed={args.seed}
        />
      </StoryCanvas>
      <StoryCanvas>
        <PlanetTextureShaderShape
          key={revision + JSON.stringify(args)}
          color={args.color3}
          seed={args.seed}
        />
      </StoryCanvas>
      <StoryCanvas>
        <TextureMixerShaderShape
          key={revision + JSON.stringify(args)}
          texture1={texture1}
          texture2={texture2}
          texture3={texture3}
          mixThreshold={args.mixThreshold}
        />
      </StoryCanvas>
      <Canvas
        orthographic
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: new Vector3(0, 0, CAMERA_HEIGHT),
          zoom: 1.0,
          far: 1000,
        }}
        style={{
          display: 'inline-block',
          width: 256,
          height: 256,
        }}
      >
        <Suspense fallback={<mesh />}>
          <ambientLight />
          <pointLight position={[0, 0, CAMERA_HEIGHT]} />
          <ThreePlanetShape
            {...ThreePlanetShapeRandomProps(args.seed, 256)}
            texture={textureMixed}
            position={new Vector(0, 0)}
            radius={256}
            visible
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  color1: '#ff00ff',
  color2: '#0000ff',
  color3: '#225500',
  mixThreshold: 0.8,
  seed: '123',
};
