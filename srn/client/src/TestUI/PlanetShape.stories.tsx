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

export default {
  title: 'Three/PlanetShape',
  component: ThreePlanetShape,
  argTypes: {},
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
          visible
        />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  color: '#008FA9',
};
