import React, { useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from '../TestUI/StoryCanvas';
import { ThreeSpaceBackground } from './ThreeSpaceBackground';
import Vector, { IVector, VectorF } from '../utils/Vector';
import { posToThreePos } from './util';
import Color from 'color';
import _ from 'lodash';

export interface ThreeTrajectoryItemProps {
  position: IVector;
  velocityNormalized: IVector; // len 0.0 - no speed, 1.0 - maximal speed, direction = speed direciton
  accNormalized: IVector; // len 0.0 - no acc, 1.0 - maximal acceleration
  mainColor: string;
  accColor: string;
}

const lerp = (a: number, b: number, v: number) => a + (b - a) * v;

const ThreeTrajectoryItem: React.FC<ThreeTrajectoryItemProps> = ({
  position,
  mainColor,
  accColor,
  velocityNormalized,
  accNormalized,
}) => {
  const angleRad = Math.PI / 4;
  const angleRad2 = Math.PI / 2;
  const [minColorL, maxColorL, baseColor] = useMemo(() => {
    const base = new Color(mainColor);
    return [base.darken(0.5).lightness(), base.lighten(0.5).lightness(), base];
  }, [mainColor]);
  const color = useMemo(() => {
    let len = Vector.fromIVector(velocityNormalized).length();
    len = Math.max(0.0, Math.min(1.0, len));
    const lerped = lerp(minColorL, maxColorL, len);
    return _.cloneDeep(baseColor).lightness(lerped);
  }, [minColorL, maxColorL, baseColor, velocityNormalized]);
  console.log({ color });
  return (
    <group position={posToThreePos(position.x, position.y)}>
      <group rotation={[0, 0, angleRad]}>
        <mesh>
          <circleBufferGeometry args={[3, 16]} />
          <meshBasicMaterial
            opacity={1.0}
            transparent
            color={color.hex().toString()}
          />
        </mesh>
        <mesh
          rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
          position={[0, 2.7, -2]}
          scale={[1.5, 1.5, 1.0]}
        >
          <tetrahedronGeometry args={[2, 0]} />
          <meshBasicMaterial opacity={1.0} color={color.hex().toString()} />
        </mesh>
      </group>
      <group rotation={[0, 0, angleRad2]}>
        <mesh
          rotation={[Math.PI * (1.66 + 0.66), Math.PI, Math.PI * 1.25]}
          position={[0, 3.0, -1]}
          scale={[0.75, 0.75, 0.5]}
        >
          <tetrahedronGeometry args={[2, 0]} />
          <meshBasicMaterial opacity={1.0} color={accColor} />
        </mesh>
      </group>
    </group>
  );
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div key={`${revision}+${JSON.stringify(args)}`}>
      <StoryCanvas zoom={16.0}>
        <ThreeSpaceBackground size={256} shaderShift={0} />
        <ThreeTrajectoryItem
          position={VectorF(0, 0)}
          velocityNormalized={VectorF(1.0, 1.0)}
          accNormalized={VectorF(0, 1)}
          mainColor="red"
          accColor="green"
        />
      </StoryCanvas>
    </div>
  );
};

export const SingleItem = Template.bind({});
SingleItem.args = {
  tickInterval: 50,
};
// noinspection JSUnusedGlobalSymbols
export default {
  title: 'Three/Trajectory',
  component: ThreeTrajectoryItem,
  argTypes: {},
} as Meta;
