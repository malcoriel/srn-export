import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { Canvas } from 'react-three-fiber';
import { CanvasTexture, Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { PlanetTextureShape } from './PlanetTextureShape';
import {
  ThreePlanetShape,
  ThreePlanetShapeRandomProps,
} from '../ThreeLayers/ThreePlanetShape';
import Vector from '../utils/Vector';
import { TextureMixerShaderShape } from './TextureMixerShaderShape';
import { Button } from '../HtmlLayers/ui/Button';
import { saveAs } from 'file-saver';
import { StoryCanvas } from './StoryCanvas';

export default {
  title: 'Three/PlanetTextureGeneration',
  component: PlanetTextureShape,
  argTypes: {
    color1: {
      control: {
        type: 'color',
      },
    },
    color2: {
      control: {
        type: 'color',
      },
    },
    color3: {
      control: {
        type: 'color',
      },
    },
    mixThreshold: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.01,
      },
    },
    colorCount: {
      control: {
        type: 'range',
        min: 8,
        max: 64,
        step: 8,
      },
    },
    maxColors: {
      control: {
        type: 'range',
        min: 32,
        max: 256,
        step: 32,
      },
    },
    saturationSpread: {
      control: {
        type: 'range',
        min: 0.05,
        max: 0.5,
        step: 0.05,
      },
    },
    valueSpread: {
      control: {
        type: 'range',
        min: 0.05,
        max: 0.5,
        step: 0.05,
      },
    },
  },
} as Meta;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, args]);
  return (
    <div>
      <Button
        onClick={() => {
          const mixedCanvas = document.querySelectorAll('canvas')[3];
          const png = mixedCanvas.toDataURL('image/png');
          saveAs(png, `${args.color1.replace('#', '')}.png`);
        }}
      >
        Save
      </Button>
      <StoryCanvas>
        <PlanetTextureShape
          key={revision + JSON.stringify(args)}
          color={args.color1}
          seed={args.seed}
          colorCount={args.colorCount}
          maxColors={args.maxColors}
          saturationSpread={args.saturationSpread}
          valueSpread={args.valueSpread}
        />
      </StoryCanvas>
      <StoryCanvas>
        <PlanetTextureShape
          key={revision + JSON.stringify(args)}
          color={args.color2}
          seed={args.seed}
          colorCount={args.colorCount}
          maxColors={args.maxColors}
          saturationSpread={args.saturationSpread}
          valueSpread={args.valueSpread}
        />
      </StoryCanvas>
      <StoryCanvas>
        <PlanetTextureShape
          key={revision + JSON.stringify(args)}
          color={args.color3}
          seed={args.seed}
          colorCount={args.colorCount}
          maxColors={args.maxColors}
          saturationSpread={args.saturationSpread}
          valueSpread={args.valueSpread}
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

const oysterHex = '#827A6B';
const orangeHex = '#bf8660';

export const Main = Template.bind({});
Main.args = {
  color1: oysterHex,
  color2: orangeHex,
  color3: '#552',
  colorCount: 64,
  maxColors: 256,
  mixThreshold: 0.8,
  saturationSpread: 0.4,
  valueSpread: 0.4,
  seed: '123',
};
