import React, { useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import {
  ShipShapeGeneration,
  ThreeInterceptorOutline,
  ThreeTriangle,
  useShapeGeometries,
} from './ShipShapeGeneration';
import { VectorF } from '../utils/Vector';
import { genGrid, GridItem, GridType } from './polygonUtils';
import { posToThreePos } from '../ThreeLayers/util';

const ThreeShapeGrid: React.FC<{ type: GridType }> = ({ type }) => {
  const grid = useMemo(
    () =>
      genGrid(
        type,
        VectorF(0, 0),
        {
          top_left: VectorF(-50, -50),
          bottom_right: VectorF(50, 50),
        },
        10
      ),
    [type]
  );
  console.log({ grid });
  const geometries = useShapeGeometries({
    multiVertices: grid.items.map((i) => i.vertices),
  });
  return (
    <group>
      {grid.items.map((item: GridItem, i) => {
        return (
          <mesh
            geometry={geometries[i]}
            position={posToThreePos(item.center.x, item.center.y)}
            rotation={[0, 0, 0.0]}
          >
            <meshBasicMaterial color="green" />
          </mesh>
        );
      })}
    </group>
  );
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas scale={2.0} withRuler>
        <ThreeSpaceBackground
          key={`${revision}+${JSON.stringify(args)}`}
          shaderShift={args.shift}
          size={512}
        />
        <ThreeTriangle
          sideSize={64}
          position={VectorF(0, 0)}
          rotationRad={args.rotationRad}
          color="red"
        />
        <ThreeShapeGrid type={GridType.Triangles} />
        <ThreeInterceptorOutline />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {
  rotationRad: 0.0,
};

export default {
  title: 'Three/ShipShapeGeneration',
  component: ShipShapeGeneration,
  argTypes: {
    rotationRad: {
      control: {
        type: 'range',
        min: 0.0,
        max: Math.PI / 2,
        step: 0.1,
      },
    },
  },
} as Meta;
