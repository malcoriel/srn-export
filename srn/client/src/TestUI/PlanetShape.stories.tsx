import React, { useEffect, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import {
  ThreePlanetShape,
  ThreePlanetShapeRandomProps,
} from '../ThreeLayers/ThreePlanetShape';
import { actionsActive } from '../utils/ShipControls';
import { ShipAction, ShipActionType } from '../world';
import Vector from '../utils/Vector';
import { possibleGasGiantColors } from '../ThreeLayers/ThreePlanetsLayer';

// noinspection JSUnusedGlobalSymbols
export default {
  title: 'Three/PlanetShape',
  component: ThreePlanetShape,
  argTypes: {
    color: {
      options: possibleGasGiantColors,
      control: {
        type: 'select',
      },
    },
    atmospherePercent: {
      control: {
        type: 'range',
        min: 0.0,
        max: 1.0,
        step: 0.025,
      },
    },
  },
} as Meta;

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  const radius = 200;
  const id = 'id';
  return (
    <div>
      <StoryCanvas>
        <mesh position={[0, 0, -10]}>
          <planeBufferGeometry args={[256, 256]} />
          <meshBasicMaterial color="#333" />
        </mesh>
        <ThreePlanetShape
          gid="1"
          radius={radius}
          {...ThreePlanetShapeRandomProps(id, radius)}
          onClick={(evt: MouseEvent) => {
            evt.stopPropagation();
            actionsActive[
              ShipActionType.DockNavigate
            ] = ShipAction.DockNavigate(id);
          }}
          position={new Vector(0, 0)}
          key={revision + JSON.stringify(args)}
          color={args.color}
          atmosphereColor={args.atmosphereColor}
          atmospherePercent={args.atmospherePercent}
          visible
        />
      </StoryCanvas>
    </div>
  );
};

export const GasGiant = Template.bind({});
GasGiant.args = {
  color: '#008FA9',
  atmospherePercent: 0.15,
  atmosphereColor: '#008FA9',
};
